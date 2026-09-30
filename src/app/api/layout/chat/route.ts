import { NextResponse } from "next/server";
import { FURNITURE_CATALOG, getCatalogItem } from "@/lib/design/catalog";
import {
	type OptimizationWeights,
	optimizeLayout,
	relationFallback,
} from "@/lib/design/optimizer";
import type { Placement, Room } from "@/lib/design/types";
import { isPlacements, isRoom } from "@/lib/design/validate";
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

function roomFromRequest(room: Room, text: string): Room {
	const lower = text.toLowerCase();
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
	message: string,
) {
	room = roomFromRequest(room, message);
	const requested = extractCatalogIds(message);
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
	const nextPlacements = addRequestedFurniture(room, placements, message);
	const weights = weightsFromText(message);
	const options = optimizeLayout(room, nextPlacements, weights);
	const names = requested.map((id) => getCatalogItem(id).name);
	const changes: string[] = [];
	if (room.wallColor !== "#e5e3da") changes.push("the wall color");
	if (room.floorColor !== "#d8cdbb") changes.push("the floor color");
	if (room.width !== 4 || room.length !== 3.5 || room.height !== 2.7)
		changes.push(`the ${room.width} x ${room.length} m room dimensions`);
	const reply =
		names.length > 0 || changes.length > 0
			? `I updated ${[...changes, ...names.map((name) => name.toLowerCase())].join(", ")} and prepared ranked layouts. Choose one below, then apply it to the room.`
			: "I reviewed the current furniture and prepared ranked layouts. Tell me what to add, remove, or prioritize, such as: 'add a sofa and keep more open space'.";
	return {
		reply,
		room,
		placements:
			options[0]?.placements ?? relationFallback(room, nextPlacements),
		options,
		source: "local-fallback" as const,
	};
}

async function askModel(room: Room, placements: Placement[], message: string) {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const response = await fetch(
			process.env.OPENAI_API_URL ??
				"https://api.openai.com/v1/chat/completions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
					temperature: 0.3,
					response_format: { type: "json_object" },
					messages: [
						{
							role: "system",
							content:
								"You are a helpful interior design chatbot. Return JSON only with reply (short string), room (complete room object), placements (complete array), and weights (ergonomics, space, vastu numbers). Apply explicit requests for width, length, ceiling height, wall colors, and floor colors. Use only catalog IDs from the supplied catalog. Preserve existing placement IDs unless the user asks to remove something. Coordinates are meters from the south-west room corner and rotations are 0, 90, 180, or 270. Keep doors clear and explain the design reasoning in reply.",
						},
						{
							role: "user",
							content: JSON.stringify({
								room,
								placements,
								catalog: FURNITURE_CATALOG.map(
									({ id, name, width, depth }) => ({ id, name, width, depth }),
								),
								request: message,
								retry: attempt > 0,
							}),
						},
					],
				}),
				signal: AbortSignal.timeout(10000),
			},
		);
		if (!response.ok) continue;
		const body = await response.json();
		try {
			const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
			if (
				!isRoom(parsed.room) ||
				!safePlacements(parsed.placements) ||
				typeof parsed.reply !== "string"
			)
				continue;
			const weights =
				parsed.weights && typeof parsed.weights === "object"
					? { ...DEFAULT_WEIGHTS, ...parsed.weights }
					: DEFAULT_WEIGHTS;
			const requestedRoom = {
				...roomFromRequest(room, message),
				wallColor:
					parsed.room.wallColor ?? roomFromRequest(room, message).wallColor,
				floorColor:
					parsed.room.floorColor ?? roomFromRequest(room, message).floorColor,
			};
			const options = optimizeLayout(requestedRoom, parsed.placements, weights);
			return {
				reply: parsed.reply,
				room: requestedRoom,
				placements: options[0]?.placements ?? parsed.placements,
				options,
				source: "llm" as const,
			};
		} catch {}
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
		);
		return NextResponse.json(
			modelResult ??
				localConversation(body.room, body.placements, body.message.trim()),
		);
	} catch {
		return NextResponse.json(
			localConversation(body.room, body.placements, body.message.trim()),
		);
	}
}
