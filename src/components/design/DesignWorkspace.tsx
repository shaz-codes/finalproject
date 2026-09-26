"use client";

import { FurniturePalette } from "./FurniturePalette";
import { Room3DViewer } from "./Room3DViewer";
import { RoomControls } from "./RoomControls";
import { RoomEditor2D } from "./RoomEditor2D";
import { SaveLoadPanel } from "./SaveLoadPanel";

export function DesignWorkspace() {
	return (
		<div className="design-workspace">
			<aside className="design-sidebar">
				<SaveLoadPanel />
				<RoomControls />
				<FurniturePalette />
			</aside>
			<section className="design-main">
				<div className="design-panel">
					<h2>2D Plan</h2>
					<RoomEditor2D />
				</div>
				<div className="design-panel">
					<h2>3D View</h2>
					<Room3DViewer />
				</div>
			</section>
		</div>
	);
}
