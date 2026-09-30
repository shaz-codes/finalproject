import type { FurnitureCatalogItem } from "./types";

// Placeholder catalog — swap for real GLB-backed assets later (see PROGRESS.md).
export const FURNITURE_CATALOG: FurnitureCatalogItem[] = [
	{
		id: "bed-queen",
		name: "Queen Bed",
		width: 1.6,
		depth: 2.0,
		height: 0.5,
		color: "#8d6e63",
	},
	{
		id: "bed-single",
		name: "Single Bed",
		width: 1.0,
		depth: 2.0,
		height: 0.5,
		color: "#a1887f",
	},
	{
		id: "wardrobe",
		name: "Wardrobe",
		width: 1.2,
		depth: 0.6,
		height: 2.0,
		color: "#5d4037",
	},
	{
		id: "study-table",
		name: "Study Table",
		width: 1.2,
		depth: 0.6,
		height: 0.75,
		color: "#795548",
	},
	{
		id: "chair",
		name: "Chair",
		width: 0.5,
		depth: 0.5,
		height: 0.9,
		color: "#6d4c41",
	},
	{
		id: "sofa",
		name: "Sofa",
		width: 1.8,
		depth: 0.85,
		height: 0.8,
		color: "#455a64",
	},
	{
		id: "coffee-table",
		name: "Coffee Table",
		width: 0.9,
		depth: 0.5,
		height: 0.4,
		color: "#4e342e",
	},
	{
		id: "bookshelf",
		name: "Bookshelf",
		width: 0.8,
		depth: 0.35,
		height: 1.8,
		color: "#3e2723",
	},
	{
		id: "nightstand",
		name: "Nightstand",
		width: 0.5,
		depth: 0.45,
		height: 0.55,
		color: "#8d6e63",
	},
	{
		id: "dining-table",
		name: "Dining Table",
		width: 1.6,
		depth: 0.9,
		height: 0.75,
		color: "#6d4c41",
	},
	{
		id: "dining-chair",
		name: "Dining Chair",
		width: 0.45,
		depth: 0.5,
		height: 0.9,
		color: "#795548",
	},
	{
		id: "tv-unit",
		name: "TV Unit",
		width: 1.5,
		depth: 0.4,
		height: 0.55,
		color: "#37474f",
	},
	{
		id: "floor-lamp",
		name: "Floor Lamp",
		width: 0.35,
		depth: 0.35,
		height: 1.7,
		color: "#c49a52",
	},
	{
		id: "plant",
		name: "Indoor Plant",
		width: 0.45,
		depth: 0.45,
		height: 1.2,
		color: "#4f7942",
	},
	{
		id: "rug",
		name: "Area Rug",
		width: 2.0,
		depth: 1.4,
		height: 0.04,
		color: "#b98275",
	},
];

export function getCatalogItem(catalogId: string): FurnitureCatalogItem {
	const item = FURNITURE_CATALOG.find((c) => c.id === catalogId);
	if (!item) throw new Error(`Unknown catalog item: ${catalogId}`);
	return item;
}
