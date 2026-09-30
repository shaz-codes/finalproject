"use client";

import type { Opening, Room } from "@/lib/design/types";

const DOOR_HEIGHT = 2.05;
const SILL_HEIGHT = 0.9;
const WINDOW_HEIGHT = 1.2;

// Position on the inner face of the wall; `inset` is the distance from the wall's center plane.
function openingTransform(opening: Opening, room: Room, inset: number) {
	switch (opening.wall) {
		case "N":
			return {
				x: opening.offset - room.width / 2,
				z: -room.length / 2 + inset,
				rotY: 0,
			};
		case "S":
			return {
				x: opening.offset - room.width / 2,
				z: room.length / 2 - inset,
				rotY: Math.PI,
			};
		case "W":
			return {
				x: -room.width / 2 + inset,
				z: opening.offset - room.length / 2,
				rotY: Math.PI / 2,
			};
		case "E":
			return {
				x: room.width / 2 - inset,
				z: opening.offset - room.length / 2,
				rotY: -Math.PI / 2,
			};
	}
}

export function RoomOpenings({ room, inset }: { room: Room; inset: number }) {
	const doorHeight = Math.min(DOOR_HEIGHT, room.height - 0.1);
	const windowHeight = Math.min(WINDOW_HEIGHT, room.height - SILL_HEIGHT - 0.2);
	return (
		<>
			{room.doors.map((door) => {
				const t = openingTransform(door, room, inset);
				return (
					<group
						key={door.id}
						position={[t.x, 0, t.z]}
						rotation={[0, t.rotY, 0]}
					>
						<mesh position={[0, (doorHeight + 0.05) / 2, 0.01]}>
							<boxGeometry args={[door.width + 0.1, doorHeight + 0.05, 0.02]} />
							<meshStandardMaterial color="#6d5443" />
						</mesh>
						<mesh position={[0, doorHeight / 2, 0.03]} castShadow>
							<boxGeometry args={[door.width, doorHeight, 0.03]} />
							<meshStandardMaterial color="#9a7650" roughness={0.7} />
						</mesh>
						<mesh position={[door.width / 2 - 0.08, 1.0, 0.06]}>
							<sphereGeometry args={[0.03, 12, 12]} />
							<meshStandardMaterial
								color="#c9a227"
								metalness={0.8}
								roughness={0.3}
							/>
						</mesh>
					</group>
				);
			})}
			{room.windows.map((win) => {
				const t = openingTransform(win, room, inset);
				const centerY = SILL_HEIGHT + windowHeight / 2;
				return (
					<group
						key={win.id}
						position={[t.x, 0, t.z]}
						rotation={[0, t.rotY, 0]}
					>
						<mesh position={[0, centerY, 0.01]}>
							<boxGeometry
								args={[win.width + 0.08, windowHeight + 0.08, 0.02]}
							/>
							<meshStandardMaterial color="#f4f1ea" />
						</mesh>
						<mesh position={[0, centerY, 0.025]}>
							<boxGeometry args={[win.width, windowHeight, 0.01]} />
							<meshStandardMaterial
								color="#cfe4f3"
								emissive="#cfe4f3"
								emissiveIntensity={0.45}
								roughness={0.1}
							/>
						</mesh>
						<mesh position={[0, centerY, 0.035]}>
							<boxGeometry args={[0.03, windowHeight, 0.01]} />
							<meshStandardMaterial color="#f4f1ea" />
						</mesh>
						<mesh position={[0, centerY, 0.035]}>
							<boxGeometry args={[win.width, 0.03, 0.01]} />
							<meshStandardMaterial color="#f4f1ea" />
						</mesh>
					</group>
				);
			})}
		</>
	);
}
