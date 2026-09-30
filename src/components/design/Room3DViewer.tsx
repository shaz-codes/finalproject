"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useDesignStore } from "@/lib/design/store";
import type { Room } from "@/lib/design/types";
import { FurnitureModel } from "./FurnitureModel";
import { WallMaterial } from "./WallMaterial";

// Inward-facing planes: walls nearest the orbit camera are back-face culled (dollhouse view).
function Walls({ room }: { room: Room }) {
	const { width, length, height } = room;
	const walls: Array<{
		position: [number, number, number];
		rotationY: number;
		span: number;
	}> = [
		{ position: [0, height / 2, -length / 2], rotationY: 0, span: width },
		{ position: [0, height / 2, length / 2], rotationY: Math.PI, span: width },
		{
			position: [-width / 2, height / 2, 0],
			rotationY: Math.PI / 2,
			span: length,
		},
		{
			position: [width / 2, height / 2, 0],
			rotationY: -Math.PI / 2,
			span: length,
		},
	];
	return (
		<group>
			<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
				<planeGeometry args={[width, length]} />
				<meshStandardMaterial color={room.floorColor ?? "#d8cdbb"} />
			</mesh>
			{walls.map((wall) => (
				<mesh
					key={wall.rotationY}
					position={wall.position}
					rotation={[0, wall.rotationY, 0]}
					receiveShadow
				>
					<planeGeometry args={[wall.span, height]} />
					<WallMaterial room={room} span={wall.span} />
				</mesh>
			))}
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
				style={{ position: "absolute", inset: 0 }}
				camera={{
					position: [diagonal * 0.7, diagonal * 0.8, diagonal * 0.7],
					fov: 45,
				}}
				onPointerMissed={() => selectFurniture(null)}
			>
				<ambientLight intensity={0.6} />
				<hemisphereLight args={["#ffffff", "#b9a88f", 0.4]} />
				<directionalLight position={[4, 6, 3]} intensity={0.8} castShadow />

				<Walls room={room} />

				{placements.map((p) => (
					<FurnitureModel
						key={p.id}
						placement={p}
						room={room}
						selected={p.id === selectedId}
						onSelect={(e) => {
							e.stopPropagation();
							selectFurniture(p.id);
						}}
					/>
				))}

				<OrbitControls makeDefault target={[0, room.height / 3, 0]} />
			</Canvas>
		</div>
	);
}
