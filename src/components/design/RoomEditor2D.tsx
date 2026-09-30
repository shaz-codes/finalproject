"use client";

import {
  type PointerEvent as ReactPointerEvent,
  useRef,
  useState,
} from "react";
import { getCatalogItem } from "@/lib/design/catalog";
import { useDesignStore } from "@/lib/design/store";
import type { Opening } from "@/lib/design/types";

const PX_PER_M = 70;
const PAD = 14;

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

  const svgRef = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<{
    id: string;
    dx: number;
    dy: number;
  } | null>(null);

  const widthPx = room.width * PX_PER_M;
  const lengthPx = room.length * PX_PER_M;

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
    moveFurniture(drag.id, coords.x - drag.dx, coords.y - drag.dy);
  }

  function handlePointerUp() {
    setDrag(null);
  }

  return (
    <div className="editor-2d">
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

        {room.doors.map((d) => {
          const { cx, cy, horizontal } = openingRect(
            d,
            room.width,
            room.length,
          );
          const w = horizontal ? d.width * PX_PER_M : 8;
          const h = horizontal ? 8 : d.width * PX_PER_M;
          return (
            <rect
              key={d.id}
              x={cx * PX_PER_M - w / 2}
              y={cy * PX_PER_M - h / 2}
              width={w}
              height={h}
              className="opening-door"
            />
          );
        })}
        {room.windows.map((win) => {
          const { cx, cy, horizontal } = openingRect(
            win,
            room.width,
            room.length,
          );
          const w = horizontal ? win.width * PX_PER_M : 8;
          const h = horizontal ? 8 : win.width * PX_PER_M;
          return (
            <rect
              key={win.id}
              x={cx * PX_PER_M - w / 2}
              y={cy * PX_PER_M - h / 2}
              width={w}
              height={h}
              className="opening-window"
            />
          );
        })}

        {placements.map((p) => {
          const item = getCatalogItem(p.catalogId);
          const swapped = p.rot === 90 || p.rot === 270;
          const w = (swapped ? item.depth : item.width) * PX_PER_M;
          const h = (swapped ? item.width : item.depth) * PX_PER_M;
          const cx = p.x * PX_PER_M;
          const cy = p.y * PX_PER_M;
          const isSelected = p.id === selectedId;
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
                  id: p.id,
                  dx: coords ? coords.x - p.x : 0,
                  dy: coords ? coords.y - p.y : 0,
                });
              }}
              className={
                drag?.id === p.id ? "furniture-item dragging" : "furniture-item"
              }
            >
              <title>{item.name}</title>
              <rect
                width={w}
                height={h}
                fill={item.color}
                className={
                  isSelected ? "furniture-rect selected" : "furniture-rect"
                }
              />
              <text x={w / 2} y={h / 2} className="furniture-label">
                {Math.min(w, h) >= 30 ? item.name : ""}
              </text>
            </g>
          );
        })}
      </svg>

      {selectedId && (
        <div className="editor-toolbar">
          <button type="button" onClick={() => rotateFurniture(selectedId)}>
            Rotate
          </button>
          <button type="button" onClick={() => removeFurniture(selectedId)}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
