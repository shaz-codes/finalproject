import { NextResponse } from "next/server";
import { FURNITURE_CATALOG, getCatalogItem } from "@/lib/design/catalog";
import { dimsOf, footprint, mountOf } from "@/lib/design/layout";
import {
	type LayoutOption,
	type OptimizationWeights,
	optimizeLayout,
	reattachRiders,
	relationFallback,
	scoreLayout,
} from "@/lib/design/optimizer";
import type { Placement, Room, Rotation } from "@/lib/design/types";
import { isPlacements, isRoom } from "@/lib/design/validate";
import { requestJson } from "@/lib/llm";
import { auth } from "../../../../../auth";

const DEFAULT_WEIGHTS: OptimizationWeights = {
	ergonomics: 50,
	space: 35,
	vastu: 15,
};

function validWeights(value: unknown): OptimizationWeights {
	if (typeof value !== "object" || value === null) return DEFAULT_WEIGHTS;
	const input = value as Record<string, unknown>;
	return {
		ergonomics:
			typeof input.ergonomics === "number"
				? Math.max(0, input.ergonomics)
				: DEFAULT_WEIGHTS.ergonomics,
		space:
			typeof input.space === "number"
				? Math.max(0, input.space)
				: DEFAULT_WEIGHTS.space,
		vastu:
			typeof input.vastu === "number"
				? Math.max(0, input.vastu)
				: DEFAULT_WEIGHTS.vastu,
	};
}

async function askModel(
	room: Room,
	placements: Placement[],
	weights: OptimizationWeights,
) {
	const round = (value: number) => Math.round(value * 100) / 100;
	return requestJson(
		(attempt) => [
			{
				role: "system",
				content: [
					"You are an interior layout optimizer. Rearrange the existing furniture for the stated priorities (0-100 weights): ergonomics (comfortable use, clearances), space (open walkways, no overlaps, doors clear) and vastu (Vastu Shastra: beds/wardrobes/heavy storage in the south-west, study in the north/east facing north or east, TV and lamps south-east, plants north/east, keep the centre and north-east open).",
					'Respond with ONE compact JSON object: {"reply": string (1-2 sentences explaining the idea), "moves": [{"id", "x", "y", "rot"}]}. Include ONLY items you move; never add or remove items.',
					"Coordinates: x,y are the item's center in meters; x from the W wall (0..width), y from the N wall (0..length). rot is 0|90|180|270; an item's front faces S at rot 0, E at 90, N at 180, W at 270 (a bed's head is opposite its front). Door/window offset is measured along its wall from the x=0 or y=0 end.",
					"Items tagged 'surface' rest on the item under them and move with it automatically; don't move them. Think briefly.",
				].join("\n"),
			},
			{
				role: "user",
				content: [
					`Priorities: ${JSON.stringify(weights)}`,
					`Room: ${JSON.stringify(room)}`,
					`Items: ${JSON.stringify(
						placements.map((placement) => {
							const { id, catalogId, x, y, rot } = placement;
							const item = getCatalogItem(catalogId);
							const size = dimsOf(placement);
							return {
								id,
								catalogId,
								size: `${round(size.width)}x${round(size.depth)}`,
								...(item.mount && item.mount !== "floor"
									? { mount: item.mount }
									: {}),
								x: round(x),
								y: round(y),
								rot,
							};
						}),
					)}`,
					attempt > 0
						? "Your previous answer was not valid. Follow the JSON shape exactly."
						: "",
				]
					.filter(Boolean)
					.join("\n"),
			},
		],
		(parsed) => {
			if (!isRecord(parsed) || !Array.isArray(parsed.moves)) return null;
			const moves = new Map<string, Record<string, unknown>>();
			for (const move of parsed.moves)
				if (isRecord(move) && typeof move.id === "string")
					moves.set(move.id, move);
			const moved = placements.map((placement) => {
				const move = moves.get(placement.id);
				if (!move || mountOf(placement) !== "floor") return placement;
				return clampPlacement(room, {
					...placement,
					x: finiteOr(move.x, placement.x),
					y: finiteOr(move.y, placement.y),
					rot: toRotation(move.rot, placement.rot),
				});
			});
			return {
				reply: typeof parsed.reply === "string" ? parsed.reply : null,
				placements: reattachRiders(placements, moved),
			};
		},
		{ temperature: 0.2 },
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteOr(value: unknown, fallback: number) {
	return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toRotation(value: unknown, fallback: Rotation): Rotation {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return ([0, 90, 180, 270] as const)[
		Math.round((((value % 360) + 360) % 360) / 90) % 4
	];
}

function clampPlacement(room: Room, placement: Placement): Placement {
	const { width, depth } = footprint(placement);
	const clamp = (value: number, min: number, max: number) =>
		Number(Math.min(Math.max(value, min), Math.max(min, max)).toFixed(2));
	return {
		...placement,
		x: clamp(placement.x, width / 2, room.width - width / 2),
		y: clamp(placement.y, depth / 2, room.length - depth / 2),
	};
}

export async function POST(request: Request) {
	const session = await auth();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (
		!body ||
		!isRoom(body.room) ||
		!isPlacements(body.placements) ||
		!body.placements.every((placement: Placement) =>
			FURNITURE_CATALOG.some((item) => item.id === placement.catalogId),
		)
	) {
		return NextResponse.json(
			{ error: "Invalid room/placements payload" },
			{ status: 400 },
		);
	}
	const weights = validWeights(body.weights);
	let proposal: Awaited<ReturnType<typeof askModel>> = null;
	try {
		proposal = await askModel(body.room, body.placements, weights);
	} catch (error) {
		console.error("AI suggest failed, using local fallback:", error);
	}
	const placements =
		proposal?.placements ?? relationFallback(body.room, body.placements);
	const ranked = optimizeLayout(body.room, placements, weights).filter(
		(option) => option.label !== "Current layout",
	);
	// Keep the model's proposal visible as its own option.
	const options: LayoutOption[] = [
		{
			label: proposal ? "AI proposal" : "Vastu-guided arrangement",
			placements,
			score: scoreLayout(body.room, placements, weights),
		},
		...ranked,
	].sort((a, b) => b.score.total - a.score.total);
	return NextResponse.json({
		source: proposal ? "llm" : "local-fallback",
		reply: proposal?.reply ?? null,
		placements,
		options,
	});
}
