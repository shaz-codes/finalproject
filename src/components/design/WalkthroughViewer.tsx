"use client";

import { PointerLockControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
	type PointerEvent as ReactPointerEvent,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import { Euler, Vector3 } from "three";
import { elevationOf, footprint, occupiesFloor } from "@/lib/design/layout";
import { useDesignStore } from "@/lib/design/store";
import type { Placement, Room } from "@/lib/design/types";
import { FurnitureModel } from "./FurnitureModel";
import { RoomOpenings } from "./RoomOpenings";
import { WallMaterial } from "./WallMaterial";

const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.25;
const SPEED = 1.4;
const WALL_THICKNESS = 0.08;
// Human vertical field of view is roughly 55-60 degrees for a natural look.
const FOV = 58;
const LOOK_SPEED = 0.004;
const MAX_PITCH = Math.PI / 2 - 0.05;

type Keys = Record<string, boolean>;
type Vec2 = { x: number; y: number };
type Mode = "idle" | "locked" | "drag";

function eyeHeight(room: Room) {
	return Math.min(EYE_HEIGHT, room.height - 0.25);
}

function isBlocked(x: number, z: number, room: Room, placements: Placement[]) {
	if (
		x < PLAYER_RADIUS - room.width / 2 ||
		x > room.width / 2 - PLAYER_RADIUS ||
		z < PLAYER_RADIUS - room.length / 2 ||
		z > room.length / 2 - PLAYER_RADIUS
	)
		return true;
	return placements.some((placement) => {
		// Rugs, tabletop, wall and ceiling items never block walking.
		if (!occupiesFloor(placement)) return false;
		const { width, depth } = footprint(placement);
		const centerX = placement.x - room.width / 2;
		const centerZ = placement.y - room.length / 2;
		return (
			Math.abs(x - centerX) < width / 2 + PLAYER_RADIUS &&
			Math.abs(z - centerZ) < depth / 2 + PLAYER_RADIUS
		);
	});
}

// Start just inside the first door (or the room center), nudged to a free spot.
function findSpawn(room: Room, placements: Placement[]) {
	const door = room.doors[0];
	const inset = PLAYER_RADIUS + 0.35;
	let x = 0;
	let z = 0;
	if (door) {
		if (door.wall === "N" || door.wall === "S") {
			x = door.offset - room.width / 2;
			z =
				door.wall === "N" ? -room.length / 2 + inset : room.length / 2 - inset;
		} else {
			z = door.offset - room.length / 2;
			x = door.wall === "W" ? -room.width / 2 + inset : room.width / 2 - inset;
		}
	}
	if (!isBlocked(x, z, room, placements)) return { x, z };
	for (
		let radius = 0.2;
		radius < Math.max(room.width, room.length);
		radius += 0.2
	) {
		for (let step = 0; step < 16; step += 1) {
			const angle = (step / 16) * Math.PI * 2;
			const cx = x + Math.cos(angle) * radius;
			const cz = z + Math.sin(angle) * radius;
			if (!isBlocked(cx, cz, room, placements)) return { x: cx, z: cz };
		}
	}
	return { x, z };
}

function RoomShell({ room }: { room: Room }) {
	const wallThickness = WALL_THICKNESS;
	return (
		<>
			<mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
				<planeGeometry args={[room.width, room.length]} />
				<meshStandardMaterial color={room.floorColor ?? "#d8cdbb"} />
			</mesh>
			<mesh rotation={[Math.PI / 2, 0, 0]} position={[0, room.height, 0]}>
				<planeGeometry args={[room.width, room.length]} />
				<meshStandardMaterial color="#f7f6f2" />
			</mesh>
			<RoomOpenings room={room} inset={WALL_THICKNESS / 2} />
			<mesh position={[0, room.height / 2, room.length / 2]}>
				<boxGeometry args={[room.width, room.height, wallThickness]} />
				<WallMaterial room={room} span={room.width} />
			</mesh>
			<mesh position={[0, room.height / 2, -room.length / 2]}>
				<boxGeometry args={[room.width, room.height, wallThickness]} />
				<WallMaterial room={room} span={room.width} />
			</mesh>
			<mesh position={[-room.width / 2, room.height / 2, 0]}>
				<boxGeometry args={[wallThickness, room.height, room.length]} />
				<WallMaterial room={room} span={room.length} />
			</mesh>
			<mesh position={[room.width / 2, room.height / 2, 0]}>
				<boxGeometry args={[wallThickness, room.height, room.length]} />
				<WallMaterial room={room} span={room.length} />
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
			{placements.map((placement) => (
				<FurnitureModel
					key={placement.id}
					placement={placement}
					room={room}
					elevation={elevationOf(placement, placements, room)}
				/>
			))}
		</>
	);
}

function FirstPersonMotion({
	room,
	placements,
	joystick,
	look,
}: {
	room: Room;
	placements: Placement[];
	joystick: RefObject<Vec2>;
	look: RefObject<Vec2>;
}) {
	const { camera } = useThree();
	const keys = useRef<Keys>({});
	const euler = useRef(new Euler(0, 0, 0, "YXZ"));
	useEffect(() => {
		const down = (event: KeyboardEvent) => {
			keys.current[event.code] = true;
		};
		const up = (event: KeyboardEvent) => {
			keys.current[event.code] = false;
		};
		const clear = () => {
			keys.current = {};
		};
		window.addEventListener("keydown", down);
		window.addEventListener("keyup", up);
		window.addEventListener("blur", clear);
		const eye = eyeHeight(room);
		const spawn = findSpawn(room, placements);
		camera.position.set(spawn.x, eye, spawn.z);
		const atCenter = Math.hypot(spawn.x, spawn.z) < 0.01;
		camera.lookAt(0, eye, atCenter ? -1 : 0);
		return () => {
			window.removeEventListener("keydown", down);
			window.removeEventListener("keyup", up);
			window.removeEventListener("blur", clear);
		};
	}, [camera, room, placements]);
	useFrame((_state, delta) => {
		if (look.current.x || look.current.y) {
			const rotation = euler.current.setFromQuaternion(camera.quaternion);
			rotation.y -= look.current.x * LOOK_SPEED;
			rotation.x = Math.max(
				-MAX_PITCH,
				Math.min(MAX_PITCH, rotation.x - look.current.y * LOOK_SPEED),
			);
			camera.quaternion.setFromEuler(rotation);
			look.current.x = 0;
			look.current.y = 0;
		}
		const pressed = (...codes: string[]) =>
			codes.some((code) => keys.current[code]) ? 1 : 0;
		const clampAxis = (value: number) => Math.max(-1, Math.min(1, value));
		const forward = clampAxis(
			pressed("KeyW", "ArrowUp") -
				pressed("KeyS", "ArrowDown") -
				joystick.current.y,
		);
		const sideways = clampAxis(
			pressed("KeyD", "ArrowRight") -
				pressed("KeyA", "ArrowLeft") +
				joystick.current.x,
		);
		if (!forward && !sideways) return;
		const run = pressed("ShiftLeft", "ShiftRight") ? 1.8 : 1;
		const direction = camera.getWorldDirection(new Vector3());
		direction.y = 0;
		direction.normalize();
		const right = { x: -direction.z, z: direction.x };
		const nextX =
			camera.position.x +
			(direction.x * forward + right.x * sideways) * SPEED * run * delta;
		const nextZ =
			camera.position.z +
			(direction.z * forward + right.z * sideways) * SPEED * run * delta;
		const stuck = isBlocked(
			camera.position.x,
			camera.position.z,
			room,
			placements,
		);
		// If we somehow start inside furniture, let the player walk out.
		if (stuck || !isBlocked(nextX, camera.position.z, room, placements))
			camera.position.x = nextX;
		if (stuck || !isBlocked(camera.position.x, nextZ, room, placements))
			camera.position.z = nextZ;
	});
	return null;
}

function Joystick({ value }: { value: RefObject<Vec2> }) {
	const baseRef = useRef<HTMLDivElement>(null);
	const [knob, setKnob] = useState<Vec2>({ x: 0, y: 0 });

	useEffect(
		() => () => {
			value.current.x = 0;
			value.current.y = 0;
		},
		[value],
	);

	function update(event: ReactPointerEvent<HTMLDivElement>) {
		const rect = baseRef.current?.getBoundingClientRect();
		if (!rect) return;
		const radius = rect.width / 2;
		let dx = event.clientX - (rect.left + radius);
		let dy = event.clientY - (rect.top + radius);
		const distance = Math.hypot(dx, dy);
		if (distance > radius) {
			dx *= radius / distance;
			dy *= radius / distance;
		}
		value.current.x = dx / radius;
		value.current.y = dy / radius;
		setKnob({ x: dx, y: dy });
	}

	function reset() {
		value.current.x = 0;
		value.current.y = 0;
		setKnob({ x: 0, y: 0 });
	}

	return (
		<div
			ref={baseRef}
			className="walkthrough-joystick"
			aria-hidden="true"
			onPointerDown={(event) => {
				event.currentTarget.setPointerCapture(event.pointerId);
				update(event);
			}}
			onPointerMove={(event) => {
				if (event.currentTarget.hasPointerCapture(event.pointerId))
					update(event);
			}}
			onPointerUp={reset}
			onPointerCancel={reset}
		>
			<span
				className="walkthrough-joystick-knob"
				style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
			/>
		</div>
	);
}

function LookArea({ look }: { look: RefObject<Vec2> }) {
	const last = useRef<{ id: number; x: number; y: number } | null>(null);
	return (
		<div
			className="walkthrough-look-area"
			aria-hidden="true"
			onPointerDown={(event) => {
				if (last.current) return;
				event.currentTarget.setPointerCapture(event.pointerId);
				last.current = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY,
				};
			}}
			onPointerMove={(event) => {
				if (last.current?.id !== event.pointerId) return;
				look.current.x += event.clientX - last.current.x;
				look.current.y += event.clientY - last.current.y;
				last.current = { ...last.current, x: event.clientX, y: event.clientY };
			}}
			onPointerUp={(event) => {
				if (last.current?.id === event.pointerId) last.current = null;
			}}
			onPointerCancel={(event) => {
				if (last.current?.id === event.pointerId) last.current = null;
			}}
		/>
	);
}

export function WalkthroughViewer() {
	const room = useDesignStore((state) => state.room);
	const placements = useDesignStore((state) => state.placements);
	const controlsRef = useRef<{ lock: () => void } | null>(null);
	const joystick = useRef<Vec2>({ x: 0, y: 0 });
	const look = useRef<Vec2>({ x: 0, y: 0 });
	const [mode, setMode] = useState<Mode>("idle");
	const started = mode !== "idle";

	useEffect(() => {
		if (mode !== "drag") return;
		const exitOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") setMode("idle");
		};
		window.addEventListener("keydown", exitOnEscape);
		return () => window.removeEventListener("keydown", exitOnEscape);
	}, [mode]);

	function start() {
		const touch = window.matchMedia("(pointer: coarse)").matches;
		if (touch || !("requestPointerLock" in HTMLElement.prototype)) {
			setMode("drag");
			return;
		}
		// Pointer lock can be refused (iframes, embedded browsers); fall back to drag-to-look.
		document.addEventListener("pointerlockerror", () => setMode("drag"), {
			once: true,
		});
		controlsRef.current?.lock();
	}

	return (
		<div
			className={`walkthrough-viewer ${started ? "is-started" : "is-ready"} ${mode === "drag" ? "is-drag" : ""}`}
		>
			<Canvas
				className="walkthrough-canvas"
				style={{ position: "absolute", inset: 0 }}
				camera={{
					position: [0, eyeHeight(room), 0],
					fov: FOV,
					near: 0.05,
					far: 100,
				}}
				shadows
			>
				<color attach="background" args={["#b9c6bc"]} />
				<ambientLight intensity={0.75} />
				<directionalLight position={[3, 5, 2]} intensity={1} castShadow />
				<RoomShell room={room} />
				<Furniture room={room} placements={placements} />
				<FirstPersonMotion
					room={room}
					placements={placements}
					joystick={joystick}
					look={look}
				/>
				<PointerLockControls
					ref={(instance) => {
						controlsRef.current = instance as unknown as {
							lock: () => void;
						} | null;
					}}
					selector=".walkthrough-canvas"
					onLock={() => setMode("locked")}
					onUnlock={() =>
						setMode((current) => (current === "locked" ? "idle" : current))
					}
				/>
			</Canvas>
			{mode === "drag" && (
				<>
					<LookArea look={look} />
					<Joystick value={joystick} />
				</>
			)}
			{!started && (
				<div className="walkthrough-start-screen">
					<div className="start-card-mark" aria-hidden="true">
						A
					</div>
					<span className="walkthrough-eyebrow">Atelier / immersive view</span>
					<h3>
						Walk through
						<br />
						your room
					</h3>
					<p>
						Explore the layout at eye level. Your furniture and clearances are
						rendered exactly as arranged.
					</p>
					<div className="walkthrough-start-stats">
						<span>
							<strong>
								{room.width.toFixed(1)} x {room.length.toFixed(1)}
							</strong>
							<small>room size</small>
						</span>
						<span>
							<strong>{placements.length}</strong>
							<small>objects placed</small>
						</span>
						<span>
							<strong>{room.height.toFixed(1)} m</strong>
							<small>ceiling height</small>
						</span>
					</div>
					<button
						type="button"
						onClick={start}
						className="start-walkthrough-button"
					>
						<span className="play-icon" aria-hidden="true">
							▶
						</span>
						Start walkthrough
					</button>
					<span className="walkthrough-keys">
						W A S D to move <i>·</i> Mouse to look <i>·</i> Touch: joystick +
						drag
					</span>
				</div>
			)}
			{started && (
				<>
					<div className="walkthrough-live-badge">
						<span className="live-dot" /> Live walkthrough
					</div>
					<div className="walkthrough-controls-card">
						<span className="controls-card-label">Navigation</span>
						{mode === "drag" ? (
							<>
								<div className="key-row">
									<kbd>Stick</kbd>
									<span>move</span>
								</div>
								<div className="key-row">
									<kbd>Drag</kbd>
									<span>look around</span>
								</div>
								<button
									type="button"
									className="walkthrough-exit"
									onClick={() => setMode("idle")}
								>
									Exit walkthrough
								</button>
							</>
						) : (
							<>
								<div className="key-row">
									<kbd>W</kbd>
									<kbd>A</kbd>
									<kbd>S</kbd>
									<kbd>D</kbd>
									<span>move</span>
								</div>
								<div className="key-row">
									<kbd>Mouse</kbd>
									<span>look around</span>
								</div>
								<div className="key-row">
									<kbd>Shift</kbd>
									<span>walk faster</span>
								</div>
								<div className="key-row">
									<kbd>Esc</kbd>
									<span>exit view</span>
								</div>
							</>
						)}
					</div>
					<p className="walkthrough-hint">
						{room.width.toFixed(1)} x {room.length.toFixed(1)} m <i>·</i>{" "}
						{placements.length} objects
					</p>
				</>
			)}
		</div>
	);
}
