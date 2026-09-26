"use client";

import { useDesignStore } from "@/lib/design/store";

export function RoomControls() {
  const room = useDesignStore((s) => s.room);
  const setRoomSize = useDesignStore((s) => s.setRoomSize);

  return (
    <div className="room-controls">
      <h2>Room</h2>
      <label>
        Width (m)
        <input
          type="number"
          min={2}
          max={10}
          step={0.1}
          value={room.width}
          onChange={(e) => setRoomSize({ width: Number(e.target.value) })}
        />
      </label>
      <label>
        Length (m)
        <input
          type="number"
          min={2}
          max={10}
          step={0.1}
          value={room.length}
          onChange={(e) => setRoomSize({ length: Number(e.target.value) })}
        />
      </label>
      <label>
        Height (m)
        <input
          type="number"
          min={2}
          max={4}
          step={0.1}
          value={room.height}
          onChange={(e) => setRoomSize({ height: Number(e.target.value) })}
        />
      </label>
    </div>
  );
}
