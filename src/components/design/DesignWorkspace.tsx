"use client";

import { useState } from "react";
import { useDesignStore } from "@/lib/design/store";
import { DesignChat } from "./DesignChat";
import { FurniturePalette } from "./FurniturePalette";
import { OptimizerPanel } from "./OptimizerPanel";
import { Room3DViewer } from "./Room3DViewer";
import { RoomControls } from "./RoomControls";
import { RoomEditor2D } from "./RoomEditor2D";
import { SaveLoadPanel } from "./SaveLoadPanel";
import { WalkthroughViewer } from "./WalkthroughViewer";

export function DesignWorkspace() {
	const [showWalkthrough, setShowWalkthrough] = useState(false);
	const room = useDesignStore((state) => state.room);
	const placements = useDesignStore((state) => state.placements);

	if (showWalkthrough) {
		return (
			<section className="walkthrough-page">
				<div className="walkthrough-page-header">
					<button
						type="button"
						className="back-to-editor"
						onClick={() => setShowWalkthrough(false)}
					>
						<span aria-hidden="true">←</span> Back to editor
					</button>
					<div className="walkthrough-page-title">
						<span className="section-kicker">Atelier / live scene</span>
						<h1>Walkthrough</h1>
					</div>
					<span className="walkthrough-room-meta">
						{room.width.toFixed(1)} x {room.length.toFixed(1)} m room
					</span>
				</div>
				<WalkthroughViewer />
			</section>
		);
	}

	return (
		<div className="design-workspace">
			<aside className="design-sidebar">
				<SaveLoadPanel />
				<RoomControls />
				<FurniturePalette />
				<OptimizerPanel />
				<DesignChat />
			</aside>
			<section className="design-main">
				<div className="design-hero-bar">
					<div>
						<span className="section-kicker">Your room / live canvas</span>
						<h1>Shape a room that feels like you.</h1>
					</div>
					<button
						type="button"
						className="walkthrough-cta"
						onClick={() => setShowWalkthrough(true)}
					>
						<span className="cta-icon" aria-hidden="true">
							▶
						</span>
						<span>
							<strong>View walkthrough</strong>
							<small>Step inside your layout</small>
						</span>
						<span aria-hidden="true">↗</span>
					</button>
				</div>
				<div className="design-panel">
					<div className="catalog-heading">
						<div>
							<span className="section-kicker">Top-down</span>
							<h2>2D Plan</h2>
						</div>
						<span className="catalog-count">{placements.length} pieces</span>
					</div>
					<RoomEditor2D />
				</div>
				<div className="design-panel">
					<div className="catalog-heading">
						<div>
							<span className="section-kicker">Explore</span>
							<h2>3D View</h2>
						</div>
						<span className="catalog-count">Drag to orbit</span>
					</div>
					<Room3DViewer />
				</div>
			</section>
		</div>
	);
}
