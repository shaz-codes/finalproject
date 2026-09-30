import { getCatalogItem } from "./catalog";
import {
	carryItems,
	footprint as dimensions,
	itemsOn,
	mountOf,
	occupiesFloor,
} from "./layout";
import type { Placement, Room, Rotation, Wall } from "./types";
import { vastuScore, type Zone } from "./vastu";

export interface OptimizationWeights {
	ergonomics: number;
	space: number;
	vastu: number;
}

export interface LayoutScore {
	total: number;
	ergonomics: number;
	space: number;
	vastu: number;
	overlaps: number;
	blockedOpenings: number;
}

export interface LayoutOption {
	placements: Placement[];
	score: LayoutScore;
	label: string;
}

const GRID = 0.1;
const CLEARANCE = 0.75;

function box(placement: Placement) {
	const { width, depth } = dimensions(placement);
	return {
		left: placement.x - width / 2,
		right: placement.x + width / 2,
		bottom: placement.y - depth / 2,
		top: placement.y + depth / 2,
	};
}

function overlap(a: Placement, b: Placement, gap = 0) {
	const first = box(a);
	const second = box(b);
	return (
		first.left < second.right + gap &&
		first.right + gap > second.left &&
		first.bottom < second.top + gap &&
		first.top + gap > second.bottom
	);
}

// y = 0 is the north wall (matches the 2D/3D views).
function wallDistance(placement: Placement, wall: Wall, room: Room) {
	const current = box(placement);
	switch (wall) {
		case "N":
			return current.bottom;
		case "S":
			return room.length - current.top;
		case "E":
			return room.width - current.right;
		case "W":
			return current.left;
	}
}

function nearestDoorDistance(placement: Placement, room: Room) {
	return Math.min(
		...room.doors.map((door) => {
			const x =
				door.wall === "E" ? room.width : door.wall === "W" ? 0 : door.offset;
			const y =
				door.wall === "N" ? 0 : door.wall === "S" ? room.length : door.offset;
			return Math.hypot(placement.x - x, placement.y - y);
		}),
		Math.hypot(room.width, room.length),
	);
}

export function scoreLayout(
	room: Room,
	placements: Placement[],
	weights: OptimizationWeights,
): LayoutScore {
	let overlaps = 0;
	let blockedOpenings = 0;
	let circulationPenalty = 0;
	for (const placement of placements) {
		const current = box(placement);
		if (
			current.left < 0 ||
			current.right > room.width ||
			current.bottom < 0 ||
			current.top > room.length
		)
			overlaps += 2;
	}
	const solid = placements.filter(occupiesFloor);
	for (let index = 0; index < solid.length; index += 1) {
		const placement = solid[index];
		for (
			let otherIndex = index + 1;
			otherIndex < solid.length;
			otherIndex += 1
		) {
			if (overlap(placement, solid[otherIndex])) overlaps += 1;
		}
		for (const opening of room.doors) {
			const nearOpening =
				opening.wall === "N" || opening.wall === "S"
					? Math.abs(placement.x - opening.offset) <
							opening.width / 2 + CLEARANCE &&
						wallDistance(placement, opening.wall, room) < CLEARANCE
					: Math.abs(placement.y - opening.offset) <
							opening.width / 2 + CLEARANCE &&
						wallDistance(placement, opening.wall, room) < CLEARANCE;
			if (nearOpening) blockedOpenings += 1;
		}
		circulationPenalty +=
			Math.max(0, CLEARANCE - nearestDoorDistance(placement, room)) * 0.08;
	}
	const space = Math.max(
		0,
		1 - (overlaps * 0.2 + blockedOpenings * 0.15 + circulationPenalty),
	);
	const ergonomics = Math.max(
		0,
		1 - overlaps * 0.35 - blockedOpenings * 0.25 - circulationPenalty,
	);
	const vastu = vastuScore(room, placements);
	const total =
		(ergonomics * weights.ergonomics +
			space * weights.space +
			vastu * weights.vastu) /
		Math.max(weights.ergonomics + weights.space + weights.vastu, 1);
	return { total, ergonomics, space, vastu, overlaps, blockedOpenings };
}

function candidatePositions(
	placement: Placement,
	room: Room,
	rotation: Rotation,
) {
	const { width, depth } = dimensions({ ...placement, rot: rotation });
	const candidates: Array<{ x: number; y: number; rot: Rotation }> = [];
	for (let x = width / 2; x <= room.width - width / 2 + 0.001; x += GRID) {
		for (let y = depth / 2; y <= room.length - depth / 2 + 0.001; y += GRID)
			candidates.push({
				x: Number(x.toFixed(2)),
				y: Number(y.toFixed(2)),
				rot: rotation,
			});
	}
	return candidates;
}

// Re-seat tabletop items on their supports after the supports moved.
export function reattachRiders(
	original: Placement[],
	moved: Placement[],
): Placement[] {
	const movedById = new Map(
		moved.map((placement) => [placement.id, placement]),
	);
	const carried = new Map<string, Placement>();
	for (const support of original) {
		if (!getCatalogItem(support.catalogId).supports) continue;
		const after = movedById.get(support.id);
		if (!after) continue;
		for (const rider of carryItems(support, after, itemsOn(support, original)))
			carried.set(rider.id, rider);
	}
	return moved.map((placement) => carried.get(placement.id) ?? placement);
}

export function optimizeLayout(
	room: Room,
	placements: Placement[],
	weights: OptimizationWeights,
	limit = 3,
): LayoutOption[] {
	const movable = placements.filter(
		(placement) => mountOf(placement) === "floor",
	);
	if (movable.length === 0)
		return [
			{
				placements,
				score: scoreLayout(room, placements, weights),
				label: "Current layout",
			},
		];
	const seeds = [movable, [...movable].reverse()];
	const options = seeds.map((seed, seedIndex) => {
		let result = placements.map((placement) => ({ ...placement }));
		for (const target of seed) {
			const current = result.find((placement) => placement.id === target.id);
			if (!current) continue;
			let best = current;
			let bestScore = scoreLayout(room, result, weights).total;
			for (const rotation of [0, 90, 180, 270] as Rotation[]) {
				for (const candidate of candidatePositions(current, room, rotation)) {
					const trial = result.map((placement) =>
						placement.id === current.id
							? { ...placement, ...candidate }
							: placement,
					);
					const score = scoreLayout(room, trial, weights).total;
					if (score > bestScore) {
						best = { ...current, ...candidate };
						bestScore = score;
					}
				}
			}
			result = result.map((placement) =>
				placement.id === current.id ? best : placement,
			);
		}
		result = reattachRiders(placements, result);
		return {
			placements: result,
			score: scoreLayout(room, result, weights),
			label: seedIndex === 0 ? "Best ergonomic fit" : "Alternative arrangement",
		};
	});
	options.push({
		placements,
		score: scoreLayout(room, placements, weights),
		label: "Current layout",
	});
	return options.sort((a, b) => b.score.total - a.score.total).slice(0, limit);
}

const FALLBACK_ZONE: Record<string, Zone> = {
	"bed-queen": "SW",
	"bed-single": "SW",
	"bunk-bed": "SW",
	wardrobe: "W",
	"drawer-cabinet": "W",
	bookshelf: "S",
	"study-table": "NE",
	sofa: "S",
	"sofa-fabric": "S",
	"sofa-grand": "S",
	armchair: "W",
	"tv-unit": "SE",
	"floor-lamp": "SE",
	"floor-lamp-square": "SE",
	plant: "NE",
	"dining-table": "W",
};

// Snap items against the walls of their Vastu-preferred zone.
export function relationFallback(room: Room, placements: Placement[]) {
	const moved = placements.map((placement) => {
		const zone = FALLBACK_ZONE[placement.catalogId];
		if (!zone) return placement;
		const { width, depth } = dimensions(placement);
		const x = zone.includes("W")
			? width / 2
			: zone.includes("E")
				? room.width - width / 2
				: room.width / 2;
		const y = zone.startsWith("N")
			? depth / 2
			: zone.startsWith("S")
				? room.length - depth / 2
				: room.length / 2;
		return { ...placement, x, y };
	});
	return reattachRiders(placements, moved);
}
