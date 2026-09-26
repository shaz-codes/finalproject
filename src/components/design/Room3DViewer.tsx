"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { getCatalogItem } from "@/lib/design/catalog";
import { useDesignStore } from "@/lib/design/store";
import type { Room } from "@/lib/design/types";

function Walls({ room }: { room: Room }) {
	const { width, length, height } = room;
	const wallColor = "#e5e3da";
	const wallThickness = 0.08;
	return (
		<group>
			{/* floor */}
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
				<planeGeometry args={[width, length]} />
				<meshStandardMaterial color="#d8cdbb" />
			</mesh>
			{/* north wall (y = length/2) */}
			<mesh position={[0, height / 2, length / 2]}>
				<boxGeometry args={[width, height, wallThickness]} />
				<meshStandardMaterial color={wallColor} />
			</mesh>
			{/* south wall (y = -length/2) */}
			<mesh position={[0, height / 2, -length / 2]}>
				<boxGeometry args={[width, height, wallThickness]} />
				<meshStandardMaterial color={wallColor} />
			</mesh>
			{/* west wall (x = -width/2) */}
			<mesh position={[-width / 2, height / 2, 0]}>
				<boxGeometry args={[wallThickness, height, length]} />
				<meshStandardMaterial color={wallColor} />
			</mesh>
			{/* east wall (x = width/2) */}
			<mesh position={[width / 2, height / 2, 0]}>
				<boxGeometry args={[wallThickness, height, length]} />
				<meshStandardMaterial color={wallColor} />
			</mesh>
		</group>
	);
}

export function Room3DViewer() {
	const room = useDesignStore((s) => s.room);
	const placements = useDesignStore((s) => s.placements);
	const selectedId = useDesignStore((s) => s.selectedId);
	const selectFurniture = useDesignStore((s) => s.selectFurniture);

	const diagonal = Math.hypot(room.width, room.length);

	return (
		<div className="viewer-3d">
			<Canvas
				shadows
				camera={{
					position: [diagonal * 0.7, diagonal * 0.8, diagonal * 0.7],
					fov: 45,
				}}
			>
				<ambientLight intensity={0.6} />
				<directionalLight position={[4, 6, 3]} intensity={0.8} castShadow />

				<Walls room={room} />

				{placements.map((p) => {
					const item = getCatalogItem(p.catalogId);
					const worldX = p.x - room.width / 2;
					const worldZ = p.y - room.length / 2;
					const isSelected = p.id === selectedId;
					return (
						// biome-ignore lint/a11y/noStaticElementInteractions: react-three-fiber mesh, not a DOM element
						<mesh
							key={p.id}
							position={[worldX, item.height / 2, worldZ]}
							rotation={[0, (p.rot * Math.PI) / 180, 0]}
							onClick={(e) => {
								e.stopPropagation();
								selectFurniture(p.id);
							}}
							castShadow
						>
							<boxGeometry args={[item.width, item.height, item.depth]} />
							<meshStandardMaterial
								color={item.color}
								emissive={isSelected ? "#ffd54f" : "#000000"}
								emissiveIntensity={isSelected ? 0.4 : 0}
							/>
						</mesh>
					);
				})}

				<OrbitControls makeDefault target={[0, room.height / 3, 0]} />
			</Canvas>
		</div>
	);
}
