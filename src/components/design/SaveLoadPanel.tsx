"use client";

import { useEffect, useState } from "react";
import {
	createDesign,
	type DesignSummary,
	deleteDesign,
	getDesign,
	listDesigns,
	updateDesign,
} from "@/lib/design/api";
import { useDesignStore } from "@/lib/design/store";

export function SaveLoadPanel() {
	const designId = useDesignStore((s) => s.designId);
	const designName = useDesignStore((s) => s.designName);
	const room = useDesignStore((s) => s.room);
	const placements = useDesignStore((s) => s.placements);
	const setDesignName = useDesignStore((s) => s.setDesignName);
	const setSavedDesign = useDesignStore((s) => s.setSavedDesign);
	const loadDesign = useDesignStore((s) => s.loadDesign);
	const resetDesign = useDesignStore((s) => s.resetDesign);

	const [designs, setDesigns] = useState<DesignSummary[]>([]);
	const [status, setStatus] = useState<"idle" | "saving" | "loading" | "error">(
		"idle",
	);
	const [error, setError] = useState<string | null>(null);

	async function refreshDesigns() {
		try {
			setDesigns(await listDesigns());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load designs");
		}
	}

	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only load
	useEffect(() => {
		refreshDesigns();
	}, []);

	async function handleSave() {
		setStatus("saving");
		setError(null);
		try {
			const saved = designId
				? await updateDesign(designId, designName, room, placements)
				: await createDesign(designName, room, placements);
			setSavedDesign(saved.id, saved.name);
			await refreshDesigns();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save design");
		} finally {
			setStatus("idle");
		}
	}

	async function handleLoad(id: string) {
		setStatus("loading");
		setError(null);
		try {
			const design = await getDesign(id);
			loadDesign(design);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load design");
		} finally {
			setStatus("idle");
		}
	}

	async function handleDelete(id: string) {
		try {
			await deleteDesign(id);
			if (id === designId) resetDesign();
			await refreshDesigns();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to delete design");
		}
	}

	return (
		<div className="save-load-panel">
			<h2>My Designs</h2>
			<label className="design-name-field">
				Name
				<input
					type="text"
					value={designName}
					onChange={(e) => setDesignName(e.target.value)}
				/>
			</label>
			<div className="save-load-actions">
				<button
					type="button"
					onClick={handleSave}
					disabled={status === "saving"}
				>
					{status === "saving"
						? "Saving…"
						: designId
							? "Save changes"
							: "Save design"}
				</button>
				<button type="button" onClick={resetDesign} className="secondary">
					New
				</button>
			</div>
			{error && <p className="save-load-error">{error}</p>}

			<ul className="design-list">
				{designs.map((d) => (
					<li key={d.id} className={d.id === designId ? "active" : undefined}>
						<button
							type="button"
							onClick={() => handleLoad(d.id)}
							disabled={status === "loading"}
						>
							{d.name}
						</button>
						<button
							type="button"
							onClick={() => handleDelete(d.id)}
							className="delete-button"
							aria-label={`Delete ${d.name}`}
						>
							×
						</button>
					</li>
				))}
				{designs.length === 0 && (
					<li className="empty-note">No saved designs yet.</li>
				)}
			</ul>
		</div>
	);
}
