import type { Opening, Placement, Room, Rotation } from "./types";

const WALLS = new Set(["N", "S", "E", "W"]);
const ROTATIONS = new Set([0, 90, 180, 270]);

function isFiniteNumber(v: unknown): v is number {
	return typeof v === "number" && Number.isFinite(v);
}

function isOpening(v: unknown): v is Opening {
	if (typeof v !== "object" || v === null) return false;
	const o = v as Record<string, unknown>;
	return (
		typeof o.id === "string" &&
		typeof o.wall === "string" &&
		WALLS.has(o.wall) &&
		isFiniteNumber(o.offset) &&
		isFiniteNumber(o.width)
	);
}

export function isRoom(v: unknown): v is Room {
	if (typeof v !== "object" || v === null) return false;
	const r = v as Record<string, unknown>;
	return (
		isFiniteNumber(r.width) &&
		isFiniteNumber(r.length) &&
		isFiniteNumber(r.height) &&
		(typeof r.wallColor === "undefined" || typeof r.wallColor === "string") &&
		(typeof r.floorColor === "undefined" || typeof r.floorColor === "string") &&
		Array.isArray(r.doors) &&
		r.doors.every(isOpening) &&
		Array.isArray(r.windows) &&
		r.windows.every(isOpening)
	);
}

function isPlacement(v: unknown): v is Placement {
	if (typeof v !== "object" || v === null) return false;
	const p = v as Record<string, unknown>;
	return (
		typeof p.id === "string" &&
		typeof p.catalogId === "string" &&
		isFiniteNumber(p.x) &&
		isFiniteNumber(p.y) &&
		typeof p.rot === "number" &&
		ROTATIONS.has(p.rot as Rotation)
	);
}

export function isPlacements(v: unknown): v is Placement[] {
	return Array.isArray(v) && v.every(isPlacement);
}
