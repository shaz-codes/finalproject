"use client";

import { FURNITURE_CATALOG } from "@/lib/design/catalog";
import { useDesignStore } from "@/lib/design/store";

export function FurniturePalette() {
  const addFurniture = useDesignStore((s) => s.addFurniture);

  return (
    <div className="furniture-palette">
      <h2>Furniture</h2>
      <ul>
        {FURNITURE_CATALOG.map((item) => (
          <li key={item.id}>
            <button type="button" onClick={() => addFurniture(item.id)}>
              <span
                className="swatch"
                style={{ background: item.color }}
                aria-hidden="true"
              />
              {item.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
