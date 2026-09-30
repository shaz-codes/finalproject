"use client";

import {
	type PointerEvent as ReactPointerEvent,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { getCatalogItem } from "@/lib/design/catalog";
import {
	dimsOf,
	elevationOf,
	footprint,
	MAX_SCALE,
	MIN_SCALE,
	mountOf,
} from "@/lib/design/layout";
import { useDesignStore } from "@/lib/design/store";
import type { Opening, Wall } from "@/lib/design/types";

const PX_PER_M = 70;
const PAD = 14;
const OPENING_THICKNESS = 10;
const SCALE_STEP = 0.1;
const HEIGHT_STEP = 0.05;
const NUDGE_STEP = 0.05;
// Space (px) the floating menu needs above an item before it flips below.
const MENU_CLEARANCE = 64;
const MENU_HALF_WIDTH = 170;

type OpeningKind = "doors" | "windows";
type Drag =
	| { type: "item"; id: string; dx: number; dy: number }
	| { type: "opening"; kind: OpeningKind; id: string };

function nearestWall(x: number, y: number, width: number, length: number) {
	const distances: Array<[Wall, number]> = [
		["N", y],
		["S", length - y],
		["W", x],
		["E", width - x],
	];
	const [wall] = distances.reduce((best, next) =>
		next[1] < best[1] ? next : best,
	);
	return { wall, offset: wall === "N" || wall === "S" ? x : y };
}

function wallLine(wall: Opening["wall"], width: number, length: number) {
	switch (wall) {
		case "N":
			return { x1: 0, y1: 0, x2: width, y2: 0 };
		case "S":
			return { x1: 0, y1: length, x2: width, y2: length };
		case "W":
			return { x1: 0, y1: 0, x2: 0, y2: length };
		case "E":
			return { x1: width, y1: 0, x2: width, y2: length };
	}
}

function openingRect(o: Opening, width: number, length: number) {
	const line = wallLine(o.wall, width, length);
	const horizontal = o.wall === "N" || o.wall === "S";
	const cx = horizontal ? o.offset : line.x1;
	const cy = horizontal ? line.y1 : o.offset;
	return { cx, cy, horizontal };
}

export function RoomEditor2D() {
	const room = useDesignStore((s) => s.room);
	const placements = useDesignStore((s) => s.placements);
	const selectedId = useDesignStore((s) => s.selectedId);
	const moveFurniture = useDesignStore((s) => s.moveFurniture);
	const selectFurniture = useDesignStore((s) => s.selectFurniture);
	const rotateFurniture = useDesignStore((s) => s.rotateFurniture);
	const removeFurniture = useDesignStore((s) => s.removeFurniture);
	const scaleFurniture = useDesignStore((s) => s.scaleFurniture);
	const setElevation = useDesignStore((s) => s.setElevation);
	const updateOpening = useDesignStore((s) => s.updateOpening);

	const containerRef = useRef<HTMLDivElement>(null);
	const svgRef = useRef<SVGSVGElement>(null);
	const [drag, setDrag] = useState<Drag | null>(null);
	const [menuPos, setMenuPos] = useState<{
		left: number;
		top: number;
		below: boolean;
	} | null>(null);

	const selected = placements.find((p) => p.id === selectedId) ?? null;

	// Anchor the floating menu to the selected item's top edge in screen space.
	// biome-ignore lint/correctness/useExhaustiveDependencies: room size changes the SVG's screen scale
	useLayoutEffect(() => {
		const svg = svgRef.current;
		const container = containerRef.current;
		if (!selected || !svg || !container) {
			setMenuPos(null);
			return;
		}
		const update = () => {
			const matrix = svg.getScreenCTM();
			if (!matrix) return;
			const { depth } = footprint(selected);
			const toScreen = (y: number) =>
				new DOMPoint(selected.x * PX_PER_M, y * PX_PER_M).matrixTransform(
					matrix,
				);
			const top = toScreen(selected.y - depth / 2);
			const bottom = toScreen(selected.y + depth / 2);
			const box = container.getBoundingClientRect();
			const below = top.y - box.top < MENU_CLEARANCE;
			const half = Math.min(MENU_HALF_WIDTH, box.width / 2);
			setMenuPos({
				left: Math.min(Math.max(top.x - box.left, half), box.width - half),
				top: (below ? bottom.y : top.y) - box.top,
				below,
			});
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(container);
		return () => observer.disconnect();
	}, [selected, room]);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			if (
				!selectedId ||
				event.ctrlKey ||
				event.metaKey ||
				event.altKey ||
				target?.closest("input, textarea, select, [contenteditable]")
			)
				return;
			const current = useDesignStore
				.getState()
				.placements.find((p) => p.id === selectedId);
			if (!current) return;
			const step = event.shiftKey ? NUDGE_STEP * 5 : NUDGE_STEP;
			const nudge = {
				ArrowLeft: [-step, 0],
				ArrowRight: [step, 0],
				ArrowUp: [0, -step],
				ArrowDown: [0, step],
			}[event.key];
			if (nudge)
				moveFurniture(selectedId, current.x + nudge[0], current.y + nudge[1]);
			else if (event.key === "Delete" || event.key === "Backspace")
				removeFurniture(selectedId);
			else if (event.key === "r" || event.key === "R")
				rotateFurniture(selectedId);
			else if (event.key === "Escape") selectFurniture(null);
			else return;
			event.preventDefault();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [
		selectedId,
		moveFurniture,
		removeFurniture,
		rotateFurniture,
		selectFurniture,
	]);

	const widthPx = room.width * PX_PER_M;
	const lengthPx = room.length * PX_PER_M;
	// Draw floor items first, then tabletop items, then ceiling items on top.
	const layered = [...placements]
		.map((placement) => ({
			placement,
			elevation: elevationOf(placement, placements, room),
		}))
		.sort((a, b) => a.elevation - b.elevation);

	// Map screen coords into room meters, accounting for the viewBox scaling.
	function toRoomCoords(e: ReactPointerEvent) {
		const svg = svgRef.current;
		const matrix = svg?.getScreenCTM();
		if (!svg || !matrix) return null;
		const point = new DOMPoint(e.clientX, e.clientY).matrixTransform(
			matrix.inverse(),
		);
		return { x: point.x / PX_PER_M, y: point.y / PX_PER_M };
	}

	function handlePointerMove(e: ReactPointerEvent) {
		if (!drag) return;
		const coords = toRoomCoords(e);
		if (!coords) return;
		if (drag.type === "item") {
			moveFurniture(drag.id, coords.x - drag.dx, coords.y - drag.dy);
			return;
		}
		updateOpening(
			drag.kind,
			drag.id,
			nearestWall(coords.x, coords.y, room.width, room.length),
		);
	}

	function startOpeningDrag(
		e: ReactPointerEvent,
		kind: OpeningKind,
		id: string,
	) {
		e.stopPropagation();
		svgRef.current?.setPointerCapture(e.pointerId);
		selectFurniture(null);
		setDrag({ type: "opening", kind, id });
	}

	function renderOpening(opening: Opening, kind: OpeningKind) {
		const { cx, cy, horizontal } = openingRect(
			opening,
			room.width,
			room.length,
		);
		const w = horizontal ? opening.width * PX_PER_M : OPENING_THICKNESS;
		const h = horizontal ? OPENING_THICKNESS : opening.width * PX_PER_M;
		const dragging = drag?.type === "opening" && drag.id === opening.id;
		return (
			<g
				key={opening.id}
				className={dragging ? "opening dragging" : "opening"}
				onPointerDown={(e) => startOpeningDrag(e, kind, opening.id)}
			>
				<title>
					{kind === "doors" ? "Door" : "Window"} — drag along or between walls
				</title>
				<rect
					x={cx * PX_PER_M - w / 2 - 6}
					y={cy * PX_PER_M - h / 2 - 6}
					width={w + 12}
					height={h + 12}
					className="opening-hit"
				/>
				<rect
					x={cx * PX_PER_M - w / 2}
					y={cy * PX_PER_M - h / 2}
					width={w}
					height={h}
					rx={2}
					className={kind === "doors" ? "opening-door" : "opening-window"}
				/>
			</g>
		);
	}

	function handlePointerUp() {
		setDrag(null);
	}

	return (
		<div className="editor-2d" ref={containerRef}>
			<span className="plan-compass" title="North is the top of the plan">
				<span aria-hidden="true">↑</span> N
			</span>
			<svg
				ref={svgRef}
				viewBox={`${-PAD} ${-PAD} ${widthPx + PAD * 2} ${lengthPx + PAD * 2}`}
				preserveAspectRatio="xMidYMid meet"
				className="room-svg"
				onPointerDown={() => selectFurniture(null)}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
			>
				<title>2D room floor plan</title>
				<defs>
					<pattern
						id="room-grid"
						width={PX_PER_M / 2}
						height={PX_PER_M / 2}
						patternUnits="userSpaceOnUse"
					>
						<path
							d={`M ${PX_PER_M / 2} 0 L 0 0 0 ${PX_PER_M / 2}`}
							className="room-grid-line"
						/>
					</pattern>
				</defs>
				<rect
					x={0}
					y={0}
					width={widthPx}
					height={lengthPx}
					className="room-floor"
				/>
				<rect
					x={0}
					y={0}
					width={widthPx}
					height={lengthPx}
					fill="url(#room-grid)"
					pointerEvents="none"
				/>

				{layered.map(({ placement: p, elevation }) => {
					const item = getCatalogItem(p.catalogId);
					const mount = mountOf(p);
					const size = footprint(p);
					const w = size.width * PX_PER_M;
					const h = size.depth * PX_PER_M;
					const cx = p.x * PX_PER_M;
					const cy = p.y * PX_PER_M;
					const isSelected = p.id === selectedId;
					// Front edge: south at rot 0, east at 90, north at 180, west at 270.
					const front = {
						0: { x: 0, y: h - 3, width: w, height: 3 },
						90: { x: w - 3, y: 0, width: 3, height: h },
						180: { x: 0, y: 0, width: w, height: 3 },
						270: { x: 0, y: 0, width: 3, height: h },
					}[p.rot];
					return (
						<g
							key={p.id}
							transform={`translate(${cx - w / 2}, ${cy - h / 2})`}
							onPointerDown={(e) => {
								e.stopPropagation();
								svgRef.current?.setPointerCapture(e.pointerId);
								selectFurniture(p.id);
								const coords = toRoomCoords(e);
								setDrag({
									type: "item",
									id: p.id,
									dx: coords ? coords.x - p.x : 0,
									dy: coords ? coords.y - p.y : 0,
								});
							}}
							className={`furniture-item mount-${mount}${
								drag?.type === "item" && drag.id === p.id ? " dragging" : ""
							}`}
						>
							<title>
								{item.name}
								{mount === "ceiling" ? " (ceiling)" : ""}
								{elevation > 0 ? ` — ${elevation.toFixed(2)} m up` : ""}
							</title>
							<rect
								width={w}
								height={h}
								fill={item.color}
								className={
									isSelected ? "furniture-rect selected" : "furniture-rect"
								}
							/>
							{mount !== "ceiling" && (
								<rect {...front} className="furniture-front" />
							)}
							<text x={w / 2} y={h / 2} className="furniture-label">
								{Math.min(w, h) >= 30 ? item.name : ""}
							</text>
						</g>
					);
				})}

				{room.doors.map((door) => renderOpening(door, "doors"))}
				{room.windows.map((win) => renderOpening(win, "windows"))}
			</svg>

			{selected && menuPos && drag?.type !== "item" && (
				<ItemMenu
					key={selected.id}
					name={getCatalogItem(selected.catalogId).name}
					position={menuPos}
					canRotate={mountOf(selected) !== "wall"}
					scale={selected.scale ?? 1}
					elevation={elevationOf(selected, placements, room)}
					maxElevation={Math.max(0, room.height - dimsOf(selected).height)}
					manualElevation={selected.z !== undefined}
					onRotate={() => rotateFurniture(selected.id)}
					onScale={(scale) => scaleFurniture(selected.id, scale)}
					onElevation={(z) => setElevation(selected.id, z)}
					onRemove={() => removeFurniture(selected.id)}
				/>
			)}
		</div>
	);
}

function ItemMenu({
	name,
	position,
	canRotate,
	scale,
	elevation,
	maxElevation,
	manualElevation,
	onRotate,
	onScale,
	onElevation,
	onRemove,
}: {
	name: string;
	position: { left: number; top: number; below: boolean };
	canRotate: boolean;
	scale: number;
	elevation: number;
	maxElevation: number;
	manualElevation: boolean;
	onRotate: () => void;
	onScale: (scale: number) => void;
	onElevation: (z: number | undefined) => void;
	onRemove: () => void;
}) {
	return (
		<div
			className={`item-menu${position.below ? " below" : ""}`}
			style={{ left: position.left, top: position.top }}
			role="toolbar"
			aria-label={`${name} options`}
		>
			<span
				className="item-menu-name"
				title="Keys: arrows nudge (Shift = faster), R rotate, Delete remove, Esc deselect"
			>
				{name}
			</span>
			{canRotate && (
				<button type="button" onClick={onRotate} title="Rotate 90°">
					⟳
				</button>
			)}
			<span className="item-menu-group" title="Size">
				<button
					type="button"
					onClick={() => onScale(scale - SCALE_STEP)}
					disabled={scale <= MIN_SCALE}
					aria-label="Smaller"
				>
					−
				</button>
				<button
					type="button"
					className="item-menu-value"
					onClick={() => onScale(1)}
					title="Size — click to reset"
				>
					{Math.round(scale * 100)}%
				</button>
				<button
					type="button"
					onClick={() => onScale(scale + SCALE_STEP)}
					disabled={scale >= MAX_SCALE}
					aria-label="Larger"
				>
					+
				</button>
			</span>
			<span className="item-menu-group" title="Height above floor">
				<button
					type="button"
					onClick={() => onElevation(elevation - HEIGHT_STEP)}
					disabled={elevation <= 0}
					aria-label="Lower"
				>
					↓
				</button>
				<button
					type="button"
					className={`item-menu-value${manualElevation ? " manual" : ""}`}
					onClick={() => onElevation(undefined)}
					disabled={!manualElevation}
					title={
						manualElevation
							? "Height set manually — click for automatic"
							: "Height above floor"
					}
				>
					↕ {elevation.toFixed(2)} m
				</button>
				<button
					type="button"
					onClick={() => onElevation(elevation + HEIGHT_STEP)}
					disabled={elevation >= maxElevation}
					aria-label="Raise"
				>
					↑
				</button>
			</span>
			<button
				type="button"
				className="item-menu-remove"
				onClick={onRemove}
				title="Remove"
			>
				✕
			</button>
		</div>
	);
}
