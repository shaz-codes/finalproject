"use client";

import { useMemo, useState } from "react";
import { FURNITURE_CATALOG } from "@/lib/design/catalog";
import { useDesignStore } from "@/lib/design/store";
import type { FurnitureCatalogItem } from "@/lib/design/types";

const CATEGORIES = [
	"All",
	...new Set(FURNITURE_CATALOG.map((item) => item.category)),
];
const STYLES: Array<{
	id: "all" | FurnitureCatalogItem["style"];
	label: string;
}> = [
	{ id: "all", label: "Any style" },
	{ id: "stylized", label: "Cartoon" },
	{ id: "realistic", label: "Realistic" },
];

export function FurniturePalette() {
	const addFurniture = useDesignStore((s) => s.addFurniture);
	const placements = useDesignStore((s) => s.placements);
	const [query, setQuery] = useState("");
	const [category, setCategory] = useState("All");
	const [style, setStyle] = useState<(typeof STYLES)[number]["id"]>("all");

	const filteredItems = useMemo(
		() =>
			FURNITURE_CATALOG.filter(
				(item) =>
					item.name.toLowerCase().includes(query.toLowerCase()) &&
					(category === "All" || item.category === category) &&
					(style === "all" || item.style === style),
			),
		[category, query, style],
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
				{CATEGORIES.map((item) => (
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
			<nav className="catalog-filters" aria-label="Model style">
				{STYLES.map((item) => (
					<button
						type="button"
						key={item.id}
						className={style === item.id ? "active" : ""}
						onClick={() => setStyle(item.id)}
					>
						{item.label}
					</button>
				))}
			</nav>
			<p className="catalog-hint">
				Select a table or desk first to drop small items onto it.
			</p>
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
							{item.style === "realistic" && (
								<span className="style-badge">Real</span>
							)}
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
