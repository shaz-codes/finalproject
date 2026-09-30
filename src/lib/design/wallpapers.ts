export const WALLPAPERS = [
	{ id: "plain", name: "Plain paint" },
	{ id: "linen", name: "Linen" },
	{ id: "stripes", name: "Wide stripes" },
	{ id: "pinstripe", name: "Pinstripe" },
	{ id: "trellis", name: "Trellis" },
	{ id: "floral", name: "Floral" },
	{ id: "dots", name: "Polka dots" },
	{ id: "chevron", name: "Chevron" },
	{ id: "brick", name: "Brick" },
	{ id: "beadboard", name: "Beadboard" },
] as const;

export type WallpaperId = (typeof WALLPAPERS)[number]["id"];

export function isWallpaperId(value: unknown): value is WallpaperId {
	return WALLPAPERS.some((wallpaper) => wallpaper.id === value);
}
