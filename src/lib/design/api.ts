import type { Placement, Room } from "./types";

export interface DesignSummary {
	id: string;
	name: string;
	createdAt: string;
	updatedAt: string;
}

export interface DesignRecord extends DesignSummary {
	room: Room;
	placements: Placement[];
}

async function parseOrThrow(res: Response) {
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error ?? `Request failed (${res.status})`);
	}
	return res.json();
}

export async function listDesigns(): Promise<DesignSummary[]> {
	const res = await fetch("/api/designs");
	const data = await parseOrThrow(res);
	return data.designs;
}

export async function getDesign(id: string): Promise<DesignRecord> {
	const res = await fetch(`/api/designs/${id}`);
	const data = await parseOrThrow(res);
	return data.design;
}

export async function createDesign(
	name: string,
	room: Room,
	placements: Placement[],
): Promise<DesignSummary> {
	const res = await fetch("/api/designs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, room, placements }),
	});
	const data = await parseOrThrow(res);
	return data.design;
}

export async function updateDesign(
	id: string,
	name: string,
	room: Room,
	placements: Placement[],
): Promise<DesignSummary> {
	const res = await fetch(`/api/designs/${id}`, {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, room, placements }),
	});
	const data = await parseOrThrow(res);
	return data.design;
}

export async function deleteDesign(id: string): Promise<void> {
	const res = await fetch(`/api/designs/${id}`, { method: "DELETE" });
	await parseOrThrow(res);
}
