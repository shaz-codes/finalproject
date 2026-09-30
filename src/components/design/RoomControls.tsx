"use client";

import { useEffect, useState } from "react";
import { useDesignStore, wallSpan } from "@/lib/design/store";
import type { Wall } from "@/lib/design/types";
import { WALLPAPERS, type WallpaperId } from "@/lib/design/wallpapers";
import { wallpaperPreview } from "./WallMaterial";

const DIMENSION_FIELDS = [
  { key: "width", label: "Width", min: 2, max: 10 },
  { key: "length", label: "Length", min: 2, max: 10 },
  { key: "height", label: "Height", min: 2, max: 4 },
] as const;

const WALL_NAMES: Record<Wall, string> = {
  N: "North",
  E: "East",
  S: "South",
  W: "West",
};

export function RoomControls() {
  const room = useDesignStore((s) => s.room);
  const setRoomSize = useDesignStore((s) => s.setRoomSize);
  const addOpening = useDesignStore((s) => s.addOpening);
  const updateOpening = useDesignStore((s) => s.updateOpening);
  const removeOpening = useDesignStore((s) => s.removeOpening);
  const [previews, setPreviews] = useState<
    Partial<Record<WallpaperId, string>>
  >({});
  const activeWallpaper = room.wallpaper ?? "plain";

  // Pattern tiles are drawn on a canvas, so build them after mount.
  useEffect(() => {
    const tiles: Partial<Record<WallpaperId, string>> = {};
    for (const { id } of WALLPAPERS) {
      const url = wallpaperPreview(id);
      if (url) tiles[id] = url;
    }
    setPreviews(tiles);
  }, []);

  return (
    <div className="room-controls">
      <div className="catalog-heading">
        <div>
          <span className="section-kicker">Floor plan</span>
          <h2>Room</h2>
        </div>
      </div>
      <div className="room-fields">
        {DIMENSION_FIELDS.map(({ key, label, min, max }) => (
          <label key={key} className="room-field">
            <span>{label}</span>
            <span className="room-field-input">
              <input
                type="number"
                min={min}
                max={max}
                step={0.1}
                value={room[key]}
                onChange={(e) => setRoomSize({ [key]: Number(e.target.value) })}
              />
              <span className="room-field-unit">m</span>
            </span>
          </label>
        ))}
        <label className="room-field">
          <span>Wall colour</span>
          <input
            type="color"
            className="room-color-input"
            value={room.wallColor}
            onChange={(e) => setRoomSize({ wallColor: e.target.value })}
          />
        </label>
        <label className="room-field">
          <span>Floor colour</span>
          <input
            type="color"
            className="room-color-input"
            value={room.floorColor}
            onChange={(e) => setRoomSize({ floorColor: e.target.value })}
          />
        </label>
      </div>
      <fieldset className="wallpaper-picker">
        <legend>Wallpaper</legend>
        <div className="wallpaper-grid">
          {WALLPAPERS.map(({ id, name }) => (
            <button
              key={id}
              type="button"
              title={name}
              aria-label={name}
              aria-pressed={activeWallpaper === id}
              className={
                activeWallpaper === id
                  ? "wallpaper-swatch active"
                  : "wallpaper-swatch"
              }
              style={{
                backgroundColor: room.wallColor,
                backgroundImage: previews[id] ? `url(${previews[id]})` : "none",
              }}
              onClick={() => setRoomSize({ wallpaper: id })}
            />
          ))}
        </div>
        <span className="wallpaper-name">
          {WALLPAPERS.find(({ id }) => id === activeWallpaper)?.name}
        </span>
      </fieldset>
      <fieldset className="openings-editor">
        <legend>Doors &amp; windows</legend>
        {(["doors", "windows"] as const).flatMap((kind) =>
          room[kind].map((opening, index) => {
            const label = `${kind === "doors" ? "Door" : "Window"} ${index + 1}`;
            return (
              <div key={opening.id} className="opening-row">
                <span className={`opening-chip ${kind}`}>{label}</span>
                <select
                  aria-label={`${label} wall`}
                  value={opening.wall}
                  onChange={(e) =>
                    updateOpening(kind, opening.id, {
                      wall: e.target.value as Wall,
                    })
                  }
                >
                  {(Object.keys(WALL_NAMES) as Wall[]).map((wall) => (
                    <option key={wall} value={wall}>
                      {WALL_NAMES[wall]}
                    </option>
                  ))}
                </select>
                <label className="opening-field">
                  <span>Pos</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0}
                    max={wallSpan(room, opening.wall)}
                    value={opening.offset}
                    onChange={(e) =>
                      updateOpening(kind, opening.id, {
                        offset: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <label className="opening-field">
                  <span>W</span>
                  <input
                    type="number"
                    step={0.1}
                    min={0.4}
                    max={wallSpan(room, opening.wall)}
                    value={opening.width}
                    onChange={(e) =>
                      updateOpening(kind, opening.id, {
                        width: Number(e.target.value),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="opening-remove"
                  aria-label={`Remove ${label}`}
                  onClick={() => removeOpening(kind, opening.id)}
                >
                  ×
                </button>
              </div>
            );
          }),
        )}
        <div className="opening-actions">
          <button type="button" onClick={() => addOpening("doors", "S")}>
            + Door
          </button>
          <button type="button" onClick={() => addOpening("windows", "N")}>
            + Window
          </button>
        </div>
        <p className="opening-hint">
          Tip: drag doors and windows in the 2D plan to move them between walls.
        </p>
      </fieldset>
    </div>
  );
}
