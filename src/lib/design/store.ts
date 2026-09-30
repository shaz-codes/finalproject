"use client";

import { create } from "zustand";
import { getCatalogItem } from "./catalog";
import {
	carryItems,
	dimsOf,
	footprint,
	itemsOn,
	MAX_SCALE,
	MIN_SCALE,
	mountOf,
	snapToWall,
} from "./layout";
import type { Opening, Placement, Room, Rotation, Wall } from "./types";

const DEFAULT_ROOM: Room = {
	width: 4,
	length: 3.5,
	height: 2.7,
	wallColor: "#e5e3da",
	floorColor: "#d8cdbb",
	wallpaper: "plain",
	doors: [{ id: "door-1", wall: "S", offset: 1.5, width: 0.9 }],
	windows: [{ id: "window-1", wall: "N", offset: 2, width: 1.2 }],
};

interface DesignState {
	designId: string | null;
	designName: string;
	room: Room;
	placements: Placement[];
	selectedId: string | null;
	setRoomSize: (
		dims: Partial<
			Pick<
				Room,
				"width" | "length" | "height" | "wallColor" | "floorColor" | "wallpaper"
			>
		>,
	) => void;
	addOpening: (kind: "doors" | "windows", wall: Wall) => void;
	updateOpening: (
		kind: "doors" | "windows",
		id: string,
		patch: Partial<Pick<Opening, "wall" | "offset" | "width">>,
	) => void;
	removeOpening: (kind: "doors" | "windows", id: string) => void;
	addFurniture: (catalogId: string) => void;
	moveFurniture: (id: string, x: number, y: number) => void;
	rotateFurniture: (id: string) => void;
	scaleFurniture: (id: string, scale: number) => void;
	/** `undefined` restores the automatic elevation for the item's mount. */
	setElevation: (id: string, z: number | undefined) => void;
	removeFurniture: (id: string) => void;
	selectFurniture: (id: string | null) => void;
	setDesignName: (name: string) => void;
	setSavedDesign: (id: string, name: string) => void;
	loadDesign: (data: {
		id: string;
		name: string;
		room: Room;
		placements: Placement[];
	}) => void;
	applyPlacements: (placements: Placement[]) => void;
	applyRoom: (room: Room) => void;
	resetDesign: () => void;
}

function clampToRoom(room: Room, placement: Placement): Placement {
	if (mountOf(placement) === "wall") return snapToWall(room, placement);
	const { width, depth } = footprint(placement);
	return {
		...placement,
		x: Math.min(Math.max(placement.x, width / 2), room.width - width / 2),
		y: Math.min(Math.max(placement.y, depth / 2), room.length - depth / 2),
	};
}

let nextId = 1;

// Time prefix avoids clashing with ids from loaded designs.
function newId(prefix: string) {
	return `${prefix}-${Date.now().toString(36)}-${nextId++}`;
}

export function wallSpan(room: Room, wall: Wall) {
	return wall === "N" || wall === "S" ? room.width : room.length;
}

function clampOpening(room: Room, opening: Opening): Opening {
	const span = wallSpan(room, opening.wall);
	const width = Math.min(Math.max(opening.width, 0.4), span - 0.1);
	const offset = Math.min(
		Math.max(opening.offset, width / 2),
		span - width / 2,
	);
	return {
		...opening,
		width: Number(width.toFixed(2)),
		offset: Number(offset.toFixed(2)),
	};
}

// Apply a move/rotation to one item and carry anything resting on it.
function transformWithRiders(
	state: { room: Room; placements: Placement[] },
	id: string,
	change: (placement: Placement) => Placement,
) {
	const before = state.placements.find((p) => p.id === id);
	if (!before) return state.placements;
	const after = clampToRoom(state.room, change(before));
	const riders = getCatalogItem(before.catalogId).supports
		? itemsOn(before, state.placements)
		: [];
	const carried = new Map(
		carryItems(before, after, riders).map((rider) => [
			rider.id,
			clampToRoom(state.room, rider),
		]),
	);
	return state.placements.map((p) =>
		p.id === id ? after : (carried.get(p.id) ?? p),
	);
}

export const useDesignStore = create<DesignState>((set) => ({
	designId: null,
	designName: "Untitled room",
	room: DEFAULT_ROOM,
	placements: [],
	selectedId: null,

	setRoomSize: (dims) => set((state) => ({ room: { ...state.room, ...dims } })),

	addOpening: (kind, wall) =>
		set((state) => {
			const opening = clampOpening(state.room, {
				id: newId(kind === "doors" ? "door" : "window"),
				wall,
				offset: wallSpan(state.room, wall) / 2,
				width: kind === "doors" ? 0.9 : 1.2,
			});
			return {
				room: { ...state.room, [kind]: [...state.room[kind], opening] },
			};
		}),

	updateOpening: (kind, id, patch) =>
		set((state) => ({
			room: {
				...state.room,
				[kind]: state.room[kind].map((opening) =>
					opening.id === id
						? clampOpening(state.room, { ...opening, ...patch })
						: opening,
				),
			},
		})),

	removeOpening: (kind, id) =>
		set((state) => ({
			room: {
				...state.room,
				[kind]: state.room[kind].filter((o) => o.id !== id),
			},
		})),

	addFurniture: (catalogId) =>
		set((state) => {
			const id = newId("item");
			const selected = state.placements.find((p) => p.id === state.selectedId);
			// Drop tabletop items onto the selected table/desk/cabinet.
			const target =
				getCatalogItem(catalogId).mount === "surface" &&
				selected &&
				getCatalogItem(selected.catalogId).supports
					? selected
					: null;
			const placement = clampToRoom(state.room, {
				id,
				catalogId,
				x: target?.x ?? state.room.width / 2,
				y: target?.y ?? state.room.length / 2,
				rot: 0,
			});
			return { placements: [...state.placements, placement], selectedId: id };
		}),

	moveFurniture: (id, x, y) =>
		set((state) => ({
			placements: transformWithRiders(state, id, (p) => ({ ...p, x, y })),
		})),

	rotateFurniture: (id) =>
		set((state) => ({
			placements: transformWithRiders(state, id, (p) => ({
				...p,
				rot: ((p.rot + 90) % 360) as Rotation,
			})),
		})),

	scaleFurniture: (id, scale) =>
		set((state) => ({
			placements: transformWithRiders(state, id, (p) => {
				const next = Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE);
				return { ...p, scale: Math.round(next * 100) / 100 };
			}),
		})),

	setElevation: (id, z) =>
		set((state) => ({
			placements: state.placements.map((p) => {
				if (p.id !== id) return p;
				if (z === undefined) {
					const { z: _removed, ...rest } = p;
					return rest;
				}
				const maxZ = Math.max(0, state.room.height - dimsOf(p).height);
				return {
					...p,
					z: Math.round(Math.min(Math.max(z, 0), maxZ) * 100) / 100,
				};
			}),
		})),

	removeFurniture: (id) =>
		set((state) => ({
			placements: state.placements.filter((p) => p.id !== id),
			selectedId: state.selectedId === id ? null : state.selectedId,
		})),

	selectFurniture: (id) => set({ selectedId: id }),

	setDesignName: (name) => set({ designName: name }),

	setSavedDesign: (id, name) => set({ designId: id, designName: name }),

	loadDesign: ({ id, name, room, placements }) =>
		set({ designId: id, designName: name, room, placements, selectedId: null }),

	applyPlacements: (placements) => set({ placements, selectedId: null }),

	applyRoom: (room) => set({ room }),

	resetDesign: () =>
		set({
			designId: null,
			designName: "Untitled room",
			room: DEFAULT_ROOM,
			placements: [],
			selectedId: null,
		}),
}));

export function getRoomJson() {
	const { room, placements } = useDesignStore.getState();
	return { room, placements };
}
