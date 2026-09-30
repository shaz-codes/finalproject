"use client";

import { useEffect, useMemo } from "react";
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { Room } from "@/lib/design/types";
import type { WallpaperId } from "@/lib/design/wallpapers";

type Pattern = Exclude<WallpaperId, "plain">;

const SIZE = 256;
const HALF = SIZE / 2;

// Real-world size in meters of one pattern tile.
const TILE_METERS: Record<Pattern, number> = {
	linen: 0.5,
	stripes: 0.6,
	pinstripe: 0.3,
	trellis: 0.45,
	floral: 0.5,
	dots: 0.3,
	chevron: 0.4,
	brick: 0.5,
	beadboard: 0.4,
};

const ink = (alpha: number) => `rgba(0, 0, 0, ${alpha})`;

function seededRandom(seed: number) {
	let state = seed;
	return () => {
		state = (state * 16807) % 2147483647;
		return state / 2147483647;
	};
}

function flower(
	ctx: CanvasRenderingContext2D,
	cx: number,
	cy: number,
	r: number,
) {
	ctx.fillStyle = ink(0.12);
	for (let petal = 0; petal < 6; petal += 1) {
		const angle = (petal / 6) * Math.PI * 2;
		ctx.beginPath();
		ctx.ellipse(
			cx + Math.cos(angle) * r * 0.55,
			cy + Math.sin(angle) * r * 0.55,
			r * 0.45,
			r * 0.2,
			angle,
			0,
			Math.PI * 2,
		);
		ctx.fill();
	}
	ctx.fillStyle = ink(0.2);
	ctx.beginPath();
	ctx.arc(cx, cy, r * 0.18, 0, Math.PI * 2);
	ctx.fill();
}

// Every pattern is drawn in translucent black on white so it tiles seamlessly and tints with any colour.
const DRAW: Record<Pattern, (ctx: CanvasRenderingContext2D) => void> = {
	linen(ctx) {
		const random = seededRandom(7);
		for (let i = 0; i < SIZE; i += 2) {
			ctx.fillStyle = ink(0.02 + random() * 0.05);
			ctx.fillRect(0, i, SIZE, 1);
			ctx.fillStyle = ink(0.02 + random() * 0.04);
			ctx.fillRect(i, 0, 1, SIZE);
		}
	},
	stripes(ctx) {
		ctx.fillStyle = ink(0.08);
		ctx.fillRect(0, 0, HALF, SIZE);
		ctx.fillStyle = ink(0.16);
		ctx.fillRect(HALF - 4, 0, 2, SIZE);
		ctx.fillRect(SIZE - 4, 0, 2, SIZE);
	},
	pinstripe(ctx) {
		ctx.fillStyle = ink(0.15);
		for (let x = 0; x < SIZE; x += 32) ctx.fillRect(x, 0, 2, SIZE);
	},
	trellis(ctx) {
		ctx.strokeStyle = ink(0.16);
		ctx.lineWidth = 4;
		ctx.beginPath();
		ctx.moveTo(0, HALF);
		ctx.lineTo(HALF, 0);
		ctx.lineTo(SIZE, HALF);
		ctx.lineTo(HALF, SIZE);
		ctx.closePath();
		ctx.stroke();
		ctx.fillStyle = ink(0.18);
		for (const [x, y] of [
			[0, HALF],
			[HALF, 0],
			[SIZE, HALF],
			[HALF, SIZE],
		]) {
			ctx.beginPath();
			ctx.arc(x, y, 9, 0, Math.PI * 2);
			ctx.fill();
		}
	},
	floral(ctx) {
		flower(ctx, HALF, HALF, 40);
		for (const [x, y] of [
			[0, 0],
			[SIZE, 0],
			[0, SIZE],
			[SIZE, SIZE],
		])
			flower(ctx, x, y, 26);
	},
	dots(ctx) {
		ctx.fillStyle = ink(0.13);
		for (const [x, y] of [
			[SIZE / 4, SIZE / 4],
			[(SIZE * 3) / 4, (SIZE * 3) / 4],
		]) {
			ctx.beginPath();
			ctx.arc(x, y, 16, 0, Math.PI * 2);
			ctx.fill();
		}
	},
	chevron(ctx) {
		ctx.strokeStyle = ink(0.1);
		ctx.lineWidth = 14;
		for (let y = -64; y <= SIZE; y += 64) {
			ctx.beginPath();
			ctx.moveTo(0, y + 32);
			ctx.lineTo(HALF, y);
			ctx.lineTo(SIZE, y + 32);
			ctx.stroke();
		}
	},
	brick(ctx) {
		const random = seededRandom(11);
		const rowHeight = SIZE / 4;
		const brickWidth = HALF;
		for (let row = 0; row < 4; row += 1) {
			const offset = row % 2 ? brickWidth / 2 : 0;
			for (let x = offset - brickWidth; x < SIZE; x += brickWidth) {
				ctx.fillStyle = ink(random() * 0.07);
				ctx.fillRect(x, row * rowHeight, brickWidth, rowHeight);
			}
			ctx.fillStyle = ink(0.24);
			ctx.fillRect(0, row * rowHeight, SIZE, 3);
			for (let x = offset; x <= SIZE; x += brickWidth)
				ctx.fillRect(x - 1, row * rowHeight, 3, rowHeight);
		}
	},
	beadboard(ctx) {
		for (let x = 0; x < SIZE; x += 32) {
			const gradient = ctx.createLinearGradient(x, 0, x + 32, 0);
			gradient.addColorStop(0, ink(0));
			gradient.addColorStop(1, ink(0.07));
			ctx.fillStyle = gradient;
			ctx.fillRect(x, 0, 32, SIZE);
			ctx.fillStyle = ink(0.22);
			ctx.fillRect(x, 0, 2, SIZE);
		}
	},
};

const cache = new Map<Pattern, CanvasTexture>();

function baseTexture(pattern: Pattern) {
	const cached = cache.get(pattern);
	if (cached) return cached;
	const canvas = document.createElement("canvas");
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext("2d");
	if (!ctx) return null;
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(0, 0, SIZE, SIZE);
	DRAW[pattern](ctx);
	const texture = new CanvasTexture(canvas);
	texture.wrapS = RepeatWrapping;
	texture.wrapT = RepeatWrapping;
	texture.colorSpace = SRGBColorSpace;
	texture.anisotropy = 8;
	cache.set(pattern, texture);
	return texture;
}

/** Data URL of the untinted pattern tile, for UI swatches (browser only). */
export function wallpaperPreview(pattern: WallpaperId) {
	if (pattern === "plain") return null;
	const image = baseTexture(pattern)?.image as HTMLCanvasElement | undefined;
	return image?.toDataURL() ?? null;
}

/** Wall material tinted with the room colour; `span` is the wall's width in meters. */
export function WallMaterial({ room, span }: { room: Room; span: number }) {
	const pattern = room.wallpaper ?? "plain";
	const texture = useMemo(() => {
		if (pattern === "plain") return null;
		const base = baseTexture(pattern);
		if (!base) return null;
		const tiled = base.clone();
		tiled.repeat.set(
			span / TILE_METERS[pattern],
			room.height / TILE_METERS[pattern],
		);
		tiled.needsUpdate = true;
		return tiled;
	}, [pattern, span, room.height]);
	useEffect(() => () => texture?.dispose(), [texture]);
	return (
		<meshStandardMaterial
			// Remount when the map is added/removed so the shader recompiles.
			key={texture ? "papered" : "painted"}
			color={room.wallColor ?? "#e5e3da"}
			map={texture}
			roughness={0.9}
		/>
	);
}
