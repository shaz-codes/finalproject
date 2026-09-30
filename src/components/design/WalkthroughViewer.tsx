"use client";

import { PointerLockControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import { Vector3 } from "three";
import { getCatalogItem } from "@/lib/design/catalog";
import { useDesignStore } from "@/lib/design/store";
import type { Placement, Room } from "@/lib/design/types";

const PLAYER_HEIGHT = 1.65;
const PLAYER_RADIUS = 0.25;
const SPEED = 2.2;

type Keys = Record<string, boolean>;

function isBlocked(x: number, z: number, room: Room, placements: Placement[]) {
	if (
		x < PLAYER_RADIUS - room.width / 2 ||
		x > room.width / 2 - PLAYER_RADIUS ||
		z < PLAYER_RADIUS - room.length / 2 ||
		z > room.length / 2 - PLAYER_RADIUS
	)
		return true;
	return placements.some((placement) => {
		const item = getCatalogItem(placement.catalogId);
		const rotated = placement.rot === 90 || placement.rot === 270;
		const width = rotated ? item.depth : item.width;
		const depth = rotated ? item.width : item.depth;
		const centerX = placement.x - room.width / 2;
		const centerZ = placement.y - room.length / 2;
		return (
			Math.abs(x - centerX) < width / 2 + PLAYER_RADIUS &&
			Math.abs(z - centerZ) < depth / 2 + PLAYER_RADIUS
		);
	});
}

function RoomShell({ room }: { room: Room }) {
	const wall = "#e5e3da";
	const wallThickness = 0.08;
	return (
		<>
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
				<planeGeometry args={[room.width, room.length]} />
				<meshStandardMaterial color="#d8cdbb" />
			</mesh>
			<mesh position={[0, room.height / 2, room.length / 2]}>
				<boxGeometry args={[room.width, room.height, wallThickness]} />
				<meshStandardMaterial color={wall} />
			</mesh>
			<mesh position={[0, room.height / 2, -room.length / 2]}>
				<boxGeometry args={[room.width, room.height, wallThickness]} />
				<meshStandardMaterial color={wall} />
			</mesh>
			<mesh position={[-room.width / 2, room.height / 2, 0]}>
				<boxGeometry args={[wallThickness, room.height, room.length]} />
				<meshStandardMaterial color={wall} />
			</mesh>
			<mesh position={[room.width / 2, room.height / 2, 0]}>
				<boxGeometry args={[wallThickness, room.height, room.length]} />
				<meshStandardMaterial color={wall} />
			</mesh>
		</>
	);
}

function Furniture({
	room,
	placements,
}: {
	room: Room;
	placements: Placement[];
}) {
	return (
		<>
			{placements.map((placement) => {
				const item = getCatalogItem(placement.catalogId);
				return (
					<mesh
						key={placement.id}
						position={[
							placement.x - room.width / 2,
							item.height / 2,
							placement.y - room.length / 2,
						]}
						rotation={[0, (placement.rot * Math.PI) / 180, 0]}
						castShadow
					>
						<boxGeometry args={[item.width, item.height, item.depth]} />
						<meshStandardMaterial color={item.color} />
					</mesh>
				);
			})}
		</>
	);
}

function FirstPersonMotion({
	room,
	placements,
}: {
	room: Room;
	placements: Placement[];
}) {
	const { camera } = useThree();
	const keys = useRef<Keys>({});
	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			keys.current[event.code] = true;
		};
		const up = (event: KeyboardEvent) => {
			keys.current[event.code] = false;
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		camera.position.set(0, PLAYER_HEIGHT, 0);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
		};
	}, [camera]);
	useFrame((_state, delta) => {
		const forward =
			Number(keys.current.KeyW || keys.current.ArrowUp) -
			Number(keys.current.KeyS || keys.current.ArrowDown);
		const sideways =
			Number(keys.current.KeyD || keys.current.ArrowRight) -
			Number(keys.current.KeyA || keys.current.ArrowLeft);
		if (!forward && !sideways) return;
		const direction = camera.getWorldDirection(new Vector3());
		direction.y = 0;
		direction.normalize();
		const right = { x: -direction.z, z: direction.x };
		const nextX =
			camera.position.x +
			(direction.x * forward + right.x * sideways) * SPEED * delta;
		const nextZ =
			camera.position.z +
			(direction.z * forward + right.z * sideways) * SPEED * delta;
		if (!isBlocked(nextX, camera.position.z, room, placements))
			camera.position.x = nextX;
		if (!isBlocked(camera.position.x, nextZ, room, placements))
			camera.position.z = nextZ;
	});
	return null;
}

export function WalkthroughViewer() {
	const room = useDesignStore((state) => state.room);
	const placements = useDesignStore((state) => state.placements);
	const controlsRef = useRef<{ lock: () => void } | null>(null);
	const [started, setStarted] = useState(false);
	return (
		<div
			className={`walkthrough-viewer ${started ? "is-started" : "is-ready"}`}
		>
			<Canvas
				className="walkthrough-canvas"
				camera={{ position: [0, PLAYER_HEIGHT, 0], fov: 70 }}
				shadows
			>
				<ambientLight intensity={0.75} />
				<directionalLight position={[3, 5, 2]} intensity={1} castShadow />
				<RoomShell room={room} />
				<Furniture room={room} placements={placements} />
				<FirstPersonMotion room={room} placements={placements} />
				<PointerLockControls
					ref={(instance) => {
						controlsRef.current = instance as unknown as {
							lock: () => void;
						} | null;
					}}
					selector=".walkthrough-canvas"
					onLock={() => setStarted(true)}
					onUnlock={() => setStarted(false)}
				/>
			</Canvas>
			{!started && (
				<div className="walkthrough-start-screen">
					<span className="walkthrough-eyebrow">Atelier / immersive view</span>
					<h3>Walk through your room</h3>
					<p>
						Explore the layout at eye level. Your furniture and clearances are
						rendered exactly as arranged.
					</p>
					<button
						type="button"
						onClick={() => controlsRef.current?.lock()}
						className="start-walkthrough-button"
					>
						<span className="play-icon" aria-hidden="true">
							▶
						</span>
						Start walkthrough
					</button>
					<span className="walkthrough-keys">
						W A S D to move <i>·</i> Mouse to look
					</span>
				</div>
			)}
			{started && (
				<p className="walkthrough-hint">
					W A S D to move <i>·</i> Mouse to look <i>·</i> Esc to exit
				</p>
			)}
		</div>
	);
}
