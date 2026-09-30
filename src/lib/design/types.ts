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

export type FurnitureCategory =
	| "Sleep"
	| "Living"
	| "Work"
	| "Dining"
	| "Storage"
	| "Lighting"
	| "Electronics"
	| "Decor"
	| "Kitchen";

/** floor: stands on the floor; surface: rests on a supporting item under it; wall: hangs flat against a wall; ceiling: hangs from the ceiling. */
export type Mount = "floor" | "surface" | "wall" | "ceiling";

export interface FurnitureCatalogItem {
	id: string;
	name: string;
	width: number; // X extent (m)
	depth: number; // Y extent (m)
	height: number; // (m)
	color: string;
	category: FurnitureCategory;
	style: "stylized" | "realistic";
	mount?: Mount;
	/** Surface items can be placed on top of this item. */
	supports?: boolean;
	/** Default height (m) of a wall item's base above the floor. */
	wallHeight?: number;
	/** glTF/GLB under /public, authored facing +Z; scaled to width/height/depth. */
	model?: string;
	/** Extra yaw (degrees) applied to the model before fitting, for assets not authored facing +Z. */
	modelYaw?: number;
	/** Emits a point light; `material` names the glowing shade/bulb material in the model. */
	light?: { color: string; intensity: number; material?: string };
}

export interface Placement {
	id: string;
	catalogId: string;
	x: number; // center, meters from west wall
	y: number; // center, meters from north wall
	rot: Rotation;
	/** Manual base height above the floor (m); overrides the mount's automatic elevation. */
	z?: number;
	/** Uniform size multiplier applied to the catalog dimensions. */
	scale?: number;
}
