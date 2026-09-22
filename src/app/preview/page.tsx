"use client";
import { OrbitControls, useGLTF } from "@react-three/drei";
import Image from "next/image";
import { Canvas } from "@react-three/fiber";

export default function Home() {
	return (
		<>
			<Canvas
				style={{
					width: "100vw",
					height: "100vh",
				}}
			>
				<App></App>
			</Canvas>
		</>
	);
}
function App() {
	return (
		<>
			<Helmet></Helmet>
			<OrbitControls></OrbitControls>
			<ambientLight intensity={0.1} />
			<directionalLight position={[0, 0, 5]} color="red" />
		</>
	);
}

function Helmet() {
	const { scene } = useGLTF("/DamagedHelmet.glb");

	return <primitive object={scene} scale={2} position={[0, -1, 0]} />;
}

useGLTF.preload("/DamagedHelmet.glb");
