"use client";

import { useMemo, useState } from "react";
import {
	type LayoutOption,
	type OptimizationWeights,
	optimizeLayout,
} from "@/lib/design/optimizer";
import { useDesignStore } from "@/lib/design/store";
import { vastuReport } from "@/lib/design/vastu";

const DEFAULT_WEIGHTS: OptimizationWeights = {
	ergonomics: 50,
	space: 35,
	vastu: 15,
};

function percent(value: number) {
	return `${Math.round(value * 100)}%`;
}

export function OptimizerPanel() {
	const room = useDesignStore((state) => state.room);
	const placements = useDesignStore((state) => state.placements);
	const applyPlacements = useDesignStore((state) => state.applyPlacements);
	const selectFurniture = useDesignStore((state) => state.selectFurniture);
	const vastu = useMemo(
		() => vastuReport(room, placements),
		[room, placements],
	);
	const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
	const [options, setOptions] = useState<LayoutOption[]>([]);
	const [selected, setSelected] = useState(0);
	const [status, setStatus] = useState<"idle" | "asking" | "error">("idle");
	const [error, setError] = useState<string | null>(null);
	const [note, setNote] = useState<string | null>(null);

	function updateWeight(key: keyof OptimizationWeights, value: number) {
		setWeights((current) => ({ ...current, [key]: value }));
	}

	function handleOptimize() {
		setError(null);
		setNote(null);
		setOptions(optimizeLayout(room, placements, weights));
		setSelected(0);
	}

	async function handleSuggest() {
		setStatus("asking");
		setError(null);
		setNote(null);
		try {
			const response = await fetch("/api/layout/optimize", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ room, placements, weights }),
			});
			const data = await response.json();
			if (!response.ok)
				throw new Error(data.error ?? "Unable to suggest a layout");
			setOptions(data.options);
			setSelected(0);
			setNote(
				data.source === "llm"
					? (data.reply ?? null)
					: "The AI is unavailable, so these are offline Vastu-guided suggestions.",
			);
		} catch (suggestionError) {
			setError(
				suggestionError instanceof Error
					? suggestionError.message
					: "Unable to suggest a layout",
			);
			setStatus("error");
			return;
		}
		setStatus("idle");
	}

	const chosen = options[selected];
	return (
		<div className="optimizer-panel">
			<div className="panel-heading">
				<div>
					<h2>Layout intelligence</h2>
					<p>Find a clear, balanced arrangement on a 10 cm grid.</p>
				</div>
				<div className="optimizer-actions">
					<button
						type="button"
						onClick={handleOptimize}
						disabled={placements.length === 0}
					>
						Optimize
					</button>
					<button
						type="button"
						onClick={handleSuggest}
						disabled={placements.length === 0 || status === "asking"}
						className="secondary-action"
					>
						{status === "asking" ? "Thinking..." : "AI suggest"}
					</button>
				</div>
			</div>
			<div className="weight-controls">
				{(Object.keys(weights) as Array<keyof OptimizationWeights>).map(
					(key) => (
						<label key={key}>
							<span>
								{key} <b>{weights[key]}</b>
							</span>
							<input
								type="range"
								min={0}
								max={100}
								value={weights[key]}
								onChange={(event) =>
									updateWeight(key, Number(event.target.value))
								}
							/>
						</label>
					),
				)}
			</div>
			{options.length > 0 && (
				<>
					<ol className="layout-options" aria-label="Ranked layout options">
						{options.map((option, index) => (
							<li key={`${option.label}-${index}`}>
								<button
									type="button"
									className={
										index === selected
											? "layout-option selected"
											: "layout-option"
									}
									onClick={() => setSelected(index)}
								>
									<span>
										{index + 1}. {option.label}
									</span>
									<strong>{percent(option.score.total)}</strong>
								</button>
							</li>
						))}
					</ol>
					{chosen && (
						<div className="optimizer-result">
							<span>Ergonomics {percent(chosen.score.ergonomics)}</span>
							<span>Space {percent(chosen.score.space)}</span>
							<span>Vastu {percent(chosen.score.vastu)}</span>
							<span>{chosen.score.overlaps} overlaps</span>
							<button
								type="button"
								onClick={() => applyPlacements(chosen.placements)}
							>
								Use this layout
							</button>
						</div>
					)}
				</>
			)}
			{note && <p className="optimizer-note">{note}</p>}
			{error && <p className="optimizer-error">{error}</p>}
			{placements.length > 0 && (
				<details className="vastu-report">
					<summary>
						<span>Vastu check</span>
						<strong>{percent(vastu.score)}</strong>
					</summary>
					<p className="vastu-legend">
						North is the top of the 2D plan. Click a tip to select the piece.
					</p>
					<ul>
						{vastu.checks.map((check) => (
							<li key={`${check.placementId ?? "room"}-${check.message}`}>
								<button
									type="button"
									className={`vastu-check ${check.status}`}
									disabled={!check.placementId}
									onClick={() =>
										check.placementId && selectFurniture(check.placementId)
									}
								>
									{check.message}
								</button>
							</li>
						))}
					</ul>
				</details>
			)}
		</div>
	);
}
