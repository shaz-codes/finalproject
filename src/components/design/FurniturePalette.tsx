"use client";

import { useMemo, useState } from "react";
import { FURNITURE_CATALOG } from "@/lib/design/catalog";
import { useDesignStore } from "@/lib/design/store";

function categoryFor(id: string) {
	return id.includes("bed")
		? "Sleep"
		: id.includes("table") || id === "chair"
			? "Work"
			: id === "sofa" || id === "coffee-table"
				? "Lounge"
				: "Storage";
}

export function FurniturePalette() {
	const addFurniture = useDesignStore((s) => s.addFurniture);
	const placements = useDesignStore((s) => s.placements);
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("All");

	const categories = ["All", "Sleep", "Work", "Lounge", "Storage"];
	const filteredItems = useMemo(
		() =>
			FURNITURE_CATALOG.filter(
				(item) =>
					item.name.toLowerCase().includes(query.toLowerCase()) &&
					(category === "All" || categoryFor(item.id) === category),
			),
		[category, query],
	);

	return (
		<div className="furniture-palette">
			<div className="catalog-heading">
				<div>
					<span className="section-kicker">Object library</span>
					<h2>Furniture</h2>
				</div>
				<span className="catalog-count">{placements.length} placed</span>
			</div>
			<label className="catalog-search">
				<span className="sr-only">Search furniture</span>
				<input
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search pieces"
				/>
				<span aria-hidden="true">/</span>
			</label>
			<nav className="catalog-filters" aria-label="Furniture categories">
				{categories.map((item) => (
					<button
						type="button"
						key={item}
						className={category === item ? "active" : ""}
						onClick={() => setCategory(item)}
					>
						{item}
					</button>
				))}
			</nav>
			<div className="furniture-grid">
				{filteredItems.map((item) => (
					<button
						type="button"
						className="furniture-card"
						key={item.id}
						onClick={() => addFurniture(item.id)}
					>
						<span
							className="furniture-preview"
							style={{ "--piece-color": item.color } as React.CSSProperties}
						>
							<span className="furniture-preview-shape" aria-hidden="true" />
							<span className="add-symbol" aria-hidden="true">
								+
							</span>
						</span>
						<span className="furniture-card-info">
							<strong>{item.name}</strong>
							<small>
								{item.width.toFixed(1)} x {item.depth.toFixed(1)} m
							</small>
						</span>
					</button>
				))}
			</div>
			{filteredItems.length === 0 && (
				<p className="catalog-empty">No pieces match your search.</p>
			)}
		</div>
	);
}
