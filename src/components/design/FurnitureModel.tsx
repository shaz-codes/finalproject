"use client";

import { Edges, useGLTF } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import {
	Box3,
	Group,
	type Material,
	type Mesh,
	MeshStandardMaterial,
	Vector3,
} from "three";
import { FURNITURE_CATALOG, getCatalogItem } from "@/lib/design/catalog";
import type { FurnitureCatalogItem, Placement, Room } from "@/lib/design/types";

// Stylized models are tiny; realistic (textured) ones load on demand.
if (typeof window !== "undefined")
	for (const item of FURNITURE_CATALOG)
		if (item.model && item.style === "stylized")
			useGLTF.preload(item.model, false, false);

function Block({ item }: { item: FurnitureCatalogItem }) {
	return (
		<mesh position={[0, item.height / 2, 0]} castShadow>
			<boxGeometry args={[item.width, item.height, item.depth]} />
			<meshStandardMaterial color={item.color} />
		</mesh>
	);
}

// Kenney lamps name their shade material "lamp".
const DEFAULT_SHADE_MATERIAL = "lamp";

// Centers the model on its footprint, sits it on the floor, and fits it to the catalog size.
function Model({ item, url }: { item: FurnitureCatalogItem; url: string }) {
	const { scene } = useGLTF(url, false, false);
	const { object, lightPosition } = useMemo(() => {
		const clone = scene.clone(true);
		const shadeName = item.light?.material ?? DEFAULT_SHADE_MATERIAL;
		const shades: Mesh[] = [];
		clone.traverse((child) => {
			const mesh = child as Mesh;
			if (!mesh.isMesh) return;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			const material = mesh.material as Material;
			if (
				item.light &&
				material.name === shadeName &&
				material instanceof MeshStandardMaterial
			) {
				const glowing = material.clone();
				glowing.emissive.set(item.light.color);
				glowing.emissiveIntensity = 0.9;
				mesh.material = glowing;
				mesh.castShadow = false;
				shades.push(mesh);
			}
		});
		const oriented = new Group();
		oriented.rotation.y = ((item.modelYaw ?? 0) * Math.PI) / 180;
		oriented.add(clone);
		oriented.updateMatrixWorld(true);
		const box = new Box3().setFromObject(oriented);
		const size = box.getSize(new Vector3());
		const center = box.getCenter(new Vector3());
		oriented.position.set(-center.x, -box.min.y, -center.z);
		const fitted = new Group();
		fitted.add(oriented);
		fitted.scale.set(
			item.width / (size.x || 1),
			item.height / (size.y || 1),
			item.depth / (size.z || 1),
		);
		let light: [number, number, number] | null = null;
		if (item.light) {
			fitted.updateMatrixWorld(true);
			const shadeBox = new Box3();
			for (const shade of shades) shadeBox.expandByObject(shade);
			const source = shadeBox.isEmpty()
				? new Vector3(0, item.height * 0.85, 0)
				: shadeBox
						.getCenter(new Vector3())
						.setY(
							Math.max(
								shadeBox.getCenter(new Vector3()).y,
								shadeBox.max.y - 0.15,
							),
						);
			light = [source.x, source.y, source.z];
		}
		return { object: fitted, lightPosition: light };
	}, [scene, item]);
	return (
		<>
			<primitive object={object} />
			{item.light && lightPosition && (
				<pointLight
					position={lightPosition}
					color={item.light.color}
					intensity={item.light.intensity}
					distance={8}
					decay={2}
				/>
			)}
		</>
	);
}

export function FurnitureModel({
	placement,
	room,
	elevation = 0,
	selected = false,
	onSelect,
}: {
	placement: Placement;
	room: Room;
	elevation?: number;
	selected?: boolean;
	onSelect?: (event: ThreeEvent<MouseEvent>) => void;
}) {
	const item = getCatalogItem(placement.catalogId);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: react-three-fiber group, not a DOM element
		<group
			position={[
				placement.x - room.width / 2,
				elevation,
				placement.y - room.length / 2,
			]}
			rotation={[0, (placement.rot * Math.PI) / 180, 0]}
			scale={placement.scale ?? 1}
			onClick={onSelect}
		>
			<Suspense fallback={<Block item={item} />}>
				{item.model ? (
					<Model item={item} url={item.model} />
				) : (
					<Block item={item} />
				)}
			</Suspense>
			{selected && (
				<mesh position={[0, item.height / 2, 0]}>
					<boxGeometry
						args={[item.width + 0.04, item.height + 0.04, item.depth + 0.04]}
					/>
					<meshBasicMaterial
						color="#ffd54f"
						transparent
						opacity={0.12}
						depthWrite={false}
					/>
					<Edges color="#ffb300" />
				</mesh>
			)}
		</group>
	);
}
