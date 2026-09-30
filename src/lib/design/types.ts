// Shared JSON contract for room + furniture layout (meters, origin = NW corner; y grows southward).

import type { WallpaperId } from "./wallpapers";

export type Rotation = 0 | 90 | 180 | 270;

export type Wall = "N" | "S" | "E" | "W";

export interface Opening {
	id: string;
	wall: Wall;
	/** Distance in meters from the wall's start corner to the opening's center. */
	offset: number;
	width: number;
}

export interface Room {
	width: number; // along X (m)
	length: number; // along Y (m)
	height: number; // (m)
	wallColor: string;
	floorColor: string;
	/** Grayscale pattern tinted by wallColor; missing means plain paint. */
	wallpaper?: WallpaperId;
	doors: Opening[];
	windows: Opening[];
}

export interface FurnitureCatalogItem {
	id: string;
	name: string;
	width: number; // X extent (m)
	depth: number; // Y extent (m)
	height: number; // (m)
	color: string;
	/** GLB under /public, authored facing +Z; scaled to width/height/depth. */
	model?: string;
	/** Emits a point light from near the top of the item (lamps). */
	light?: { color: string; intensity: number };
}

export interface Placement {
	id: string;
	catalogId: string;
	x: number; // center, meters from west wall
	y: number; // center, meters from north wall
	rot: Rotation;
}
