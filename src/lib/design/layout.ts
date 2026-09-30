import { getCatalogItem } from "./catalog";
import type { Mount, Placement, Room, Rotation, Wall } from "./types";

export const MIN_SCALE = 0.5;
export const MAX_SCALE = 2;
const DEFAULT_WALL_HEIGHT = 1.4;

export function mountOf(placement: Placement): Mount {
	return getCatalogItem(placement.catalogId).mount ?? "floor";
}

/** Catalog size multiplied by the placement's scale (unrotated). */
export function dimsOf(placement: Placement) {
	const item = getCatalogItem(placement.catalogId);
	const scale = placement.scale ?? 1;
	return {
		width: item.width * scale,
		depth: item.depth * scale,
		height: item.height * scale,
	};
}

export function footprint(placement: Placement) {
	const { width, depth } = dimsOf(placement);
	const rotated = placement.rot === 90 || placement.rot === 270;
	return {
		width: rotated ? depth : width,
		depth: rotated ? width : depth,
	};
}

/** Standing on the floor with real height, so it blocks walking and other floor items. */
export function occupiesFloor(placement: Placement) {
	return (
		mountOf(placement) === "floor" &&
		(placement.z ?? 0) < 0.05 &&
		dimsOf(placement).height >= 0.1
	);
}

function contains(support: Placement, x: number, y: number) {
	const { width, depth } = footprint(support);
	return (
		Math.abs(x - support.x) <= width / 2 && Math.abs(y - support.y) <= depth / 2
	);
}

/** The tallest supporting item under a surface item's center, if any. */
export function supportOf(placement: Placement, placements: Placement[]) {
	if (mountOf(placement) !== "surface" || placement.z !== undefined)
		return null;
	let best: Placement | null = null;
	let bestTop = -1;
	for (const other of placements) {
		if (other.id === placement.id) continue;
		const item = getCatalogItem(other.catalogId);
		if (!item.supports || !contains(other, placement.x, placement.y)) continue;
		const top = (other.z ?? 0) + dimsOf(other).height;
		if (top > bestTop) {
			best = other;
			bestTop = top;
		}
	}
	return best;
}

/** Height (m) of the item's base above the floor. */
export function elevationOf(
	placement: Placement,
	placements: Placement[],
	room: Room,
): number {
	const item = getCatalogItem(placement.catalogId);
	const { height } = dimsOf(placement);
	const maxZ = Math.max(0, room.height - height);
	if (placement.z !== undefined)
		return Math.min(Math.max(placement.z, 0), maxZ);
	const mount = item.mount ?? "floor";
	if (mount === "ceiling") return maxZ;
	if (mount === "wall")
		return Math.min(item.wallHeight ?? DEFAULT_WALL_HEIGHT, maxZ);
	if (mount === "surface") {
		const support = supportOf(placement, placements);
		return support
			? elevationOf(support, placements, room) + dimsOf(support).height
			: 0;
	}
	return 0;
}

const WALL_ROTATION: Record<Wall, Rotation> = { N: 0, E: 270, S: 180, W: 90 };

/** Pushes a wall item flat against the nearest wall, facing into the room. */
export function snapToWall(room: Room, placement: Placement): Placement {
	const { width, depth } = dimsOf(placement);
	const distances: Array<[Wall, number]> = [
		["N", placement.y],
		["S", room.length - placement.y],
		["W", placement.x],
		["E", room.width - placement.x],
	];
	const [wall] = distances.reduce((best, next) =>
		next[1] < best[1] ? next : best,
	);
	const along = (value: number, span: number) =>
		Math.min(Math.max(value, width / 2), span - width / 2);
	switch (wall) {
		case "N":
			return {
				...placement,
				x: along(placement.x, room.width),
				y: depth / 2,
				rot: WALL_ROTATION.N,
			};
		case "S":
			return {
				...placement,
				x: along(placement.x, room.width),
				y: room.length - depth / 2,
				rot: WALL_ROTATION.S,
			};
		case "W":
			return {
				...placement,
				x: depth / 2,
				y: along(placement.y, room.length),
				rot: WALL_ROTATION.W,
			};
		case "E":
			return {
				...placement,
				x: room.width - depth / 2,
				y: along(placement.y, room.length),
				rot: WALL_ROTATION.E,
			};
	}
}

/** Surface items currently resting on `support`. */
export function itemsOn(support: Placement, placements: Placement[]) {
	return placements.filter(
		(placement) => supportOf(placement, placements)?.id === support.id,
	);
}

// Same convention as the 3D scene: rotation about +Y, plan y is world z.
export function rotateOffset(dx: number, dy: number, degrees: number) {
	const angle = (degrees * Math.PI) / 180;
	const cos = Math.cos(angle);
	const sin = Math.sin(angle);
	return { dx: dx * cos + dy * sin, dy: -dx * sin + dy * cos };
}

/** Moves the items resting on `before` so they follow it to `after`. */
export function carryItems(
	before: Placement,
	after: Placement,
	riders: Placement[],
): Placement[] {
	const turn = (after.rot - before.rot + 360) % 360;
	const stretch = (after.scale ?? 1) / (before.scale ?? 1);
	return riders.map((rider) => {
		const { dx, dy } = rotateOffset(
			(rider.x - before.x) * stretch,
			(rider.y - before.y) * stretch,
			turn,
		);
		return {
			...rider,
			x: after.x + dx,
			y: after.y + dy,
			rot: ((rider.rot + turn) % 360) as Rotation,
		};
	});
}
