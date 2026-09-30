"use client";

import { useEffect, useState } from "react";
import { useDesignStore } from "@/lib/design/store";
import { WALLPAPERS, type WallpaperId } from "@/lib/design/wallpapers";
import { wallpaperPreview } from "./WallMaterial";

const DIMENSION_FIELDS = [
  { key: "width", label: "Width", min: 2, max: 10 },
  { key: "length", label: "Length", min: 2, max: 10 },
  { key: "height", label: "Height", min: 2, max: 4 },
] as const;

export function RoomControls() {
  const room = useDesignStore((s) => s.room);
  const setRoomSize = useDesignStore((s) => s.setRoomSize);
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
    </div>
  );
}
