"use client";

import { create } from "zustand";
import { getCatalogItem } from "./catalog";
import type { Opening, Placement, Room, Rotation, Wall } from "./types";

const DEFAULT_ROOM: Room = {
	width: 4,
	length: 3.5,
	height: 2.7,
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
		dims: Partial<Pick<Room, "width" | "length" | "height">>,
	) => void;
	addOpening: (kind: "doors" | "windows", wall: Wall) => void;
	removeOpening: (kind: "doors" | "windows", id: string) => void;
	addFurniture: (catalogId: string) => void;
	moveFurniture: (id: string, x: number, y: number) => void;
	rotateFurniture: (id: string) => void;
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
	resetDesign: () => void;
}

function clampToRoom(
	room: Room,
	catalogId: string,
	x: number,
	y: number,
	rot: Rotation,
) {
	const item = getCatalogItem(catalogId);
	const halfW = (rot === 90 || rot === 270 ? item.depth : item.width) / 2;
	const halfD = (rot === 90 || rot === 270 ? item.width : item.depth) / 2;
	return {
		x: Math.min(Math.max(x, halfW), room.width - halfW),
		y: Math.min(Math.max(y, halfD), room.length - halfD),
	};
}

let nextId = 1;

export const useDesignStore = create<DesignState>((set) => ({
	designId: null,
	designName: "Untitled room",
	room: DEFAULT_ROOM,
	placements: [],
	selectedId: null,

	setRoomSize: (dims) => set((state) => ({ room: { ...state.room, ...dims } })),

	addOpening: (kind, wall) =>
		set((state) => {
			const opening: Opening = {
				id: `${kind}-${nextId++}`,
				wall,
				offset: 1,
				width: kind === "doors" ? 0.9 : 1.2,
			};
			return {
				room: { ...state.room, [kind]: [...state.room[kind], opening] },
			};
		}),

	removeOpening: (kind, id) =>
		set((state) => ({
			room: {
				...state.room,
				[kind]: state.room[kind].filter((o) => o.id !== id),
			},
		})),

	addFurniture: (catalogId) =>
		set((state) => {
			const id = `item-${nextId++}`;
			const { x, y } = clampToRoom(
				state.room,
				catalogId,
				state.room.width / 2,
				state.room.length / 2,
				0,
			);
			const placement: Placement = { id, catalogId, x, y, rot: 0 };
			return { placements: [...state.placements, placement], selectedId: id };
		}),

	moveFurniture: (id, x, y) =>
		set((state) => ({
			placements: state.placements.map((p) => {
				if (p.id !== id) return p;
				const clamped = clampToRoom(state.room, p.catalogId, x, y, p.rot);
				return { ...p, ...clamped };
			}),
		})),

	rotateFurniture: (id) =>
		set((state) => ({
			placements: state.placements.map((p) => {
				if (p.id !== id) return p;
				const rot = ((p.rot + 90) % 360) as Rotation;
				const clamped = clampToRoom(state.room, p.catalogId, p.x, p.y, rot);
				return { ...p, rot, ...clamped };
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
