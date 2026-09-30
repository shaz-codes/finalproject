import { NextResponse } from "next/server";
import { FURNITURE_CATALOG, getCatalogItem } from "@/lib/design/catalog";
import {
	type LayoutOption,
	type OptimizationWeights,
	optimizeLayout,
	relationFallback,
	scoreLayout,
} from "@/lib/design/optimizer";
import type { Placement, Room, Rotation } from "@/lib/design/types";
import { isPlacements, isRoom } from "@/lib/design/validate";
import {
	isWallpaperId,
	WALLPAPERS,
	type WallpaperId,
} from "@/lib/design/wallpapers";
import { auth } from "../../../../../auth";

const DEFAULT_WEIGHTS: OptimizationWeights = {
	ergonomics: 50,
	space: 35,
	vastu: 15,
};

const CATALOG_ALIASES: Record<string, string[]> = {
	"bed-queen": ["queen bed", "double bed", "bed"],
	"bed-single": ["single bed", "single cot"],
	wardrobe: ["wardrobe", "closet", "almirah"],
	"study-table": ["study table", "desk", "work table"],
	chair: ["chair", "seat"],
	sofa: ["sofa", "couch"],
	"coffee-table": ["coffee table", "center table"],
	bookshelf: ["bookshelf", "book shelf", "shelf"],
	nightstand: ["nightstand", "bedside table", "side table"],
	"dining-table": ["dining table", "dinner table"],
	"dining-chair": ["dining chair"],
	"tv-unit": ["tv unit", "television unit", "tv stand"],
	"floor-lamp": ["floor lamp", "lamp"],
	plant: ["plant", "indoor plant"],
	rug: ["rug", "carpet"],
};

const COLORS: Record<string, string> = {
	pink: "#e8a6b5",
	blue: "#9fc5e8",
	green: "#a8c59b",
	yellow: "#ead58b",
	white: "#f7f5ef",
	black: "#242824",
	grey: "#aeb5b0",
	gray: "#aeb5b0",
	beige: "#d8cdbb",
	cream: "#f1e5c8",
	terra: "#c87561",
	purple: "#b9a4d0",
};

// Checked in order, so "pinstripe" wins over "stripe".
const WALLPAPER_KEYWORDS: Array<[WallpaperId, string[]]> = [
	["plain", ["plain wall", "no wallpaper", "remove wallpaper"]],
	["pinstripe", ["pinstripe", "pin stripe"]],
	["stripes", ["stripe"]],
	["floral", ["floral", "flower"]],
	["dots", ["polka", "dot"]],
	["brick", ["brick"]],
	["chevron", ["chevron", "zigzag"]],
	["trellis", ["trellis", "lattice", "diamond"]],
	["beadboard", ["beadboard", "panel"]],
	["linen", ["linen", "textured"]],
];

function roomFromRequest(room: Room, text: string): Room {
	const lower = text.toLowerCase();
	const wallpaper = lower.includes("wall")
		? WALLPAPER_KEYWORDS.find(([, words]) =>
				words.some((word) => lower.includes(word)),
			)?.[0]
		: undefined;
	const pair = lower.match(
		/(\d+(?:\.\d+)?)\s*(m|meter|metre|ft|feet)?\s*(?:x|by)\s*(\d+(?:\.\d+)?)/,
	);
	const convert = (value: string, unit?: string) =>
		Number(value) * (/ft|feet/.test(unit ?? "") ? 0.3048 : 1);
	let width = room.width;
	let length = room.length;
	if (pair) {
		width = convert(pair[1], pair[2]);
		length = convert(pair[3], pair[2]);
	}
	const widthMatch = lower.match(
		/(?:width|wide)\s*(?:is|of|=)?\s*(\d+(?:\.\d+)?)\s*(m|meter|metre|ft|feet)?/,
	);
	const lengthMatch = lower.match(
		/(?:length|long)\s*(?:is|of|=)?\s*(\d+(?:\.\d+)?)\s*(m|meter|metre|ft|feet)?/,
	);
	const heightMatch = lower.match(
		/(?:height|ceiling)\s*(?:is|of|=)?\s*(\d+(?:\.\d+)?)\s*(m|meter|metre|ft|feet)?/,
	);
	if (widthMatch) width = convert(widthMatch[1], widthMatch[2]);
	if (lengthMatch) length = convert(lengthMatch[1], lengthMatch[2]);
	const color = Object.entries(COLORS).find(
		([name]) =>
			(lower.includes("wall") && lower.includes(name)) ||
			lower.includes(`${name} wall`) ||
			lower.includes(`${name} walls`),
	)?.[1];
	const floorColor = Object.entries(COLORS).find(
		([name]) => lower.includes("floor") && lower.includes(name),
	)?.[1];
	return {
		...room,
		width: Math.max(2, Math.min(20, Number(width.toFixed(2)))),
		length: Math.max(2, Math.min(20, Number(length.toFixed(2)))),
		height: heightMatch
			? Math.max(
					2,
					Math.min(
						5,
						Number(convert(heightMatch[1], heightMatch[2]).toFixed(2)),
					),
				)
			: room.height,
		wallColor: color ?? room.wallColor ?? "#e5e3da",
		floorColor: floorColor ?? room.floorColor ?? "#d8cdbb",
		wallpaper: wallpaper ?? room.wallpaper,
	};
}

function safePlacements(value: unknown): value is Placement[] {
	return (
		isPlacements(value) &&
		value.every((placement) =>
			FURNITURE_CATALOG.some((item) => item.id === placement.catalogId),
		)
	);
}

const ROTATIONS = [0, 90, 180, 270] as const;
const MAX_HISTORY = 12;
const MAX_TURN_LENGTH = 1000;

type ChatTurn = { role: "user" | "assistant"; text: string };

function sanitizeHistory(value: unknown): ChatTurn[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter(
			(turn): turn is ChatTurn =>
				typeof turn === "object" &&
				turn !== null &&
				(turn.role === "user" || turn.role === "assistant") &&
				typeof turn.text === "string" &&
				turn.text.trim() !== "",
		)
		.slice(-MAX_HISTORY)
		.map(({ role, text }) => ({ role, text: text.slice(0, MAX_TURN_LENGTH) }));
}

function chatCompletionsUrl() {
	const base = (process.env.OPENAI_API_URL ?? "https://api.openai.com").replace(
		/\/+$/,
		"",
	);
	if (base.endsWith("/chat/completions")) return base;
	return /\/v\d+$/.test(base)
		? `${base}/chat/completions`
		: `${base}/v1/chat/completions`;
}

function clampRoom(room: Room): Room {
	const clamp = (value: number, min: number, max: number) =>
		Math.max(min, Math.min(max, Number(value.toFixed(2))));
	return {
		...room,
		width: clamp(room.width, 2, 20),
		length: clamp(room.length, 2, 20),
		height: clamp(room.height, 2, 5),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOr(value: unknown, fallback: number) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toRotation(value: unknown, fallback: Rotation): Rotation {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return ROTATIONS[Math.round((((value % 360) + 360) % 360) / 90) % 4];
}

function hexOr(value: unknown, fallback: string) {
	return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
		? value
		: fallback;
}

function clampPlacement(room: Room, placement: Placement): Placement {
	const item = getCatalogItem(placement.catalogId);
	const rotated = placement.rot === 90 || placement.rot === 270;
	const halfW = (rotated ? item.depth : item.width) / 2;
	const halfD = (rotated ? item.width : item.depth) / 2;
	const clamp = (value: number, min: number, max: number) =>
		Number(Math.min(Math.max(value, min), Math.max(min, max)).toFixed(2));
	return {
		...placement,
		x: clamp(placement.x, halfW, room.width - halfW),
		y: clamp(placement.y, halfD, room.length - halfD),
	};
}

// Apply the model's diff (room patch + add/update/remove) to the current state.
function applyModelChanges(
	room: Room,
	placements: Placement[],
	changes: Record<string, unknown>,
) {
	const patch = isRecord(changes.room) ? changes.room : {};
	const nextRoom = clampRoom({
		...room,
		width: finiteOr(patch.width, room.width),
		length: finiteOr(patch.length, room.length),
		height: finiteOr(patch.height, room.height),
		wallColor: hexOr(patch.wallColor, room.wallColor),
		floorColor: hexOr(patch.floorColor, room.floorColor),
		wallpaper: isWallpaperId(patch.wallpaper)
			? patch.wallpaper
			: room.wallpaper,
	});

	const removed = new Set(
		Array.isArray(changes.remove)
			? changes.remove.filter((id) => typeof id === "string")
			: [],
	);
	const updates = new Map<string, Record<string, unknown>>();
	if (Array.isArray(changes.update))
		for (const update of changes.update)
			if (isRecord(update) && typeof update.id === "string")
				updates.set(update.id, update);

	const kept = placements
		.filter((placement) => !removed.has(placement.id))
		.map((placement) => {
			const update = updates.get(placement.id);
			if (!update) return placement;
			return {
				...placement,
				x: finiteOr(update.x, placement.x),
				y: finiteOr(update.y, placement.y),
				rot: toRotation(update.rot, placement.rot),
			};
		});

	const stamp = Date.now();
	const added: Placement[] = (Array.isArray(changes.add) ? changes.add : [])
		.filter(
			(entry): entry is Record<string, unknown> =>
				isRecord(entry) &&
				FURNITURE_CATALOG.some((item) => item.id === entry.catalogId),
		)
		.map((entry, index) => ({
			id: `chat-item-${stamp}-${index}`,
			catalogId: entry.catalogId as string,
			x: finiteOr(entry.x, nextRoom.width / 2),
			y: finiteOr(entry.y, nextRoom.length / 2),
			rot: toRotation(entry.rot, 0),
		}));

	return {
		room: nextRoom,
		placements: [...kept, ...added].map((placement) =>
			clampPlacement(nextRoom, placement),
		),
	};
}

function normalizeWeights(value: unknown): OptimizationWeights {
	if (!isRecord(value)) return DEFAULT_WEIGHTS;
	const raw = value;
	const pick = (key: keyof OptimizationWeights) => {
		const number = Number(raw[key]);
		return Number.isFinite(number)
			? Math.max(0, Math.min(100, number))
			: DEFAULT_WEIGHTS[key];
	};
	return {
		ergonomics: pick("ergonomics"),
		space: pick("space"),
		vastu: pick("vastu"),
	};
}

function weightsFromText(text: string): OptimizationWeights {
	const lower = text.toLowerCase();
	return {
		ergonomics:
			lower.includes("comfort") || lower.includes("ergonomic")
				? 65
				: DEFAULT_WEIGHTS.ergonomics,
		space:
			lower.includes("space") ||
			lower.includes("open") ||
			lower.includes("small")
				? 55
				: DEFAULT_WEIGHTS.space,
		vastu:
			lower.includes("vastu") || lower.includes("direction")
				? 35
				: DEFAULT_WEIGHTS.vastu,
	};
}

function extractCatalogIds(text: string) {
	const lower = text.toLowerCase();
	return FURNITURE_CATALOG.filter((item) =>
		(CATALOG_ALIASES[item.id] ?? [item.name.toLowerCase()]).some((alias) =>
			lower.includes(alias),
		),
	).map((item) => item.id);
}

function addRequestedFurniture(
	room: Room,
	placements: Placement[],
	requested: string[],
) {
	const additions = requested.map((catalogId, index) => {
		const item = getCatalogItem(catalogId);
		return {
			id: `chat-item-${Date.now()}-${index}`,
			catalogId,
			x: Math.min(room.width - item.width / 2, room.width / 2 + index * 0.2),
			y: Math.min(room.length - item.depth / 2, room.length / 2 + index * 0.2),
			rot: 0 as const,
		};
	});
	return [...placements, ...additions];
}

function localConversation(
	room: Room,
	placements: Placement[],
	message: string,
) {
	const requested = extractCatalogIds(message);
	const nextRoom = roomFromRequest(room, message);
	const nextPlacements = addRequestedFurniture(nextRoom, placements, requested);
	const weights = weightsFromText(message);
	const options = optimizeLayout(nextRoom, nextPlacements, weights);
	const names = requested.map((id) => getCatalogItem(id).name.toLowerCase());
	const changes: string[] = [];
	if (nextRoom.wallColor !== room.wallColor) changes.push("the wall color");
	if (nextRoom.floorColor !== room.floorColor) changes.push("the floor color");
	if (nextRoom.wallpaper !== room.wallpaper)
		changes.push(
			`the wallpaper to ${WALLPAPERS.find(({ id }) => id === nextRoom.wallpaper)?.name.toLowerCase()}`,
		);
	if (
		nextRoom.width !== room.width ||
		nextRoom.length !== room.length ||
		nextRoom.height !== room.height
	)
		changes.push(
			`the room size to ${nextRoom.width} x ${nextRoom.length} x ${nextRoom.height} m`,
		);
	if (names.length > 0) changes.push(`added ${names.join(", ")}`);
	const reply =
		changes.length > 0
			? `Done: ${changes.join("; ")}. I applied the best-ranked layout; pick another suggestion below if you prefer.`
			: "I re-ranked the current furniture. Tell me what to add or prioritize, e.g. 'add a sofa and keep more open space'.";
	return {
		reply,
		room: nextRoom,
		placements:
			options[0]?.placements ?? relationFallback(nextRoom, nextPlacements),
		options,
		source: "local-fallback" as const,
	};
}

const SYSTEM_PROMPT = [
	"You are a friendly interior design assistant in an ongoing conversation. Earlier messages are the chat history; the last user message holds the CURRENT room state and the new request. Use the history to resolve references like 'it', 'that sofa', or 'undo'.",
	"Respond with ONE compact JSON object containing ONLY what changes. Omit every key that has no change. Never repeat unchanged items or room fields.",
	'Shape: {"reply": string, "room"?: {"width"?, "length"?, "height"? (meters), "wallColor"?, "floorColor"? ("#rrggbb"), "wallpaper"?}, "add"?: [{"catalogId", "x", "y", "rot"}], "update"?: [{"id", "x"?, "y"?, "rot"?}], "remove"?: ["id"], "weights"?: {"ergonomics", "space", "vastu"} (0-100, only when the user states priorities)}',
	`wallpaper is one of ${WALLPAPERS.map(({ id }) => id).join("|")}; it is a pattern tinted by wallColor.`,
	"Coordinates: x,y are the item's center in meters; x from the W wall (0..width), y from the N wall (0..length). rot is 0|90|180|270. Door/window offset is measured along its wall from the x=0 or y=0 end.",
	"Orientation: an item's front (where you sit, the open side) faces S at rot 0, E at 90, N at 180, W at 270. A bed's head is opposite its front; at a desk you face opposite its front.",
	"Use only catalog ids. Keep doors clear and avoid overlaps. If the request is just a question, answer it in reply with no other keys.",
	"reply: at most 2 short sentences. Think briefly.",
].join("\n");

function describeState(room: Room, placements: Placement[]) {
	const round = (value: number) => Math.round(value * 100) / 100;
	return JSON.stringify({
		room,
		items: placements.map(({ id, catalogId, x, y, rot }) => ({
			id,
			catalogId,
			x: round(x),
			y: round(y),
			rot,
		})),
		catalog: FURNITURE_CATALOG.map(
			({ id, width, depth }) => `${id} ${width}x${depth}`,
		),
	});
}

async function askModel(
	room: Room,
	placements: Placement[],
	message: string,
	history: ChatTurn[],
) {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;
	// Reasoning models can take 20-50s; one deadline covers the retry too.
	const signal = AbortSignal.timeout(90000);
	const reasoningEffort = process.env.OPENAI_REASONING_EFFORT;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const response = await fetch(chatCompletionsUrl(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
				temperature: 0.3,
				response_format: { type: "json_object" },
				...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
				messages: [
					{ role: "system", content: SYSTEM_PROMPT },
					...history.map(({ role, text }) => ({ role, content: text })),
					{
						role: "user",
						content: [
							`Current state: ${describeState(room, placements)}`,
							`Request: ${message}`,
							attempt > 0
								? "Your previous answer was not valid. Follow the JSON shape exactly."
								: "",
						]
							.filter(Boolean)
							.join("\n"),
					},
				],
			}),
			signal,
		});
		if (!response.ok) {
			console.error(
				`Design chat LLM request failed (${response.status}):`,
				(await response.text().catch(() => "")).slice(0, 300),
			);
			continue;
		}
		const body = await response.json();
		try {
			const parsed: unknown = JSON.parse(
				body.choices?.[0]?.message?.content ?? "{}",
			);
			if (!isRecord(parsed) || typeof parsed.reply !== "string") {
				console.error("Design chat LLM returned an unexpected shape");
				continue;
			}
			const next = applyModelChanges(room, placements, parsed);
			const weights = normalizeWeights(parsed.weights);
			// Keep the assistant's own layout first; optimizer results are alternatives.
			const options: LayoutOption[] = [
				{
					label: "Assistant's layout",
					placements: next.placements,
					score: scoreLayout(next.room, next.placements, weights),
				},
				...optimizeLayout(next.room, next.placements, weights).filter(
					(option) => option.label !== "Current layout",
				),
			];
			return {
				reply: parsed.reply,
				room: next.room,
				placements: next.placements,
				options,
				source: "llm" as const,
			};
		} catch {
			console.error("Design chat LLM returned invalid JSON");
		}
	}
	return null;
}

export async function POST(request: Request) {
	const session = await auth();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (
		!body ||
		!isRoom(body.room) ||
		!safePlacements(body.placements) ||
		typeof body.message !== "string" ||
		!body.message.trim()
	) {
		return NextResponse.json(
			{ error: "A room, placements, and message are required" },
			{ status: 400 },
		);
	}
	try {
		const modelResult = await askModel(
			body.room,
			body.placements,
			body.message.trim(),
			sanitizeHistory(body.history),
		);
		return NextResponse.json(
			modelResult ??
				localConversation(body.room, body.placements, body.message.trim()),
		);
	} catch (error) {
		console.error("Design chat LLM error, using local fallback:", error);
		return NextResponse.json(
			localConversation(body.room, body.placements, body.message.trim()),
		);
	}
}
