import { NextResponse } from "next/server";
import {
	type OptimizationWeights,
	optimizeLayout,
	relationFallback,
} from "@/lib/design/optimizer";
import { isPlacements, isRoom } from "@/lib/design/validate";
import { auth } from "../../../../../auth";

const DEFAULT_WEIGHTS: OptimizationWeights = {
	ergonomics: 50,
	space: 35,
	vastu: 15,
};

function validWeights(value: unknown): OptimizationWeights {
	if (typeof value !== "object" || value === null) return DEFAULT_WEIGHTS;
	const input = value as Record<string, unknown>;
	return {
		ergonomics:
			typeof input.ergonomics === "number"
				? Math.max(0, input.ergonomics)
				: DEFAULT_WEIGHTS.ergonomics,
		space:
			typeof input.space === "number"
				? Math.max(0, input.space)
				: DEFAULT_WEIGHTS.space,
		vastu:
			typeof input.vastu === "number"
				? Math.max(0, input.vastu)
				: DEFAULT_WEIGHTS.vastu,
	};
}

async function askModel(room: unknown, placements: unknown) {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;
	for (let attempt = 0; attempt < 2; attempt += 1) {
		const response = await fetch(
			process.env.OPENAI_API_URL ??
				"https://api.openai.com/v1/chat/completions",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${apiKey}`,
				},
				body: JSON.stringify({
					model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
					temperature: 0.2,
					response_format: { type: "json_object" },
					messages: [
						{
							role: "system",
							content:
								"You are an interior layout proposer. Return only JSON with a placements array. Preserve every placement id and catalogId. Coordinates are meters from the south-west room corner; rotations must be 0, 90, 180, or 270. Prefer relations to walls and keep doors clear.",
						},
						{
							role: "user",
							content: JSON.stringify({ room, placements, retry: attempt > 0 }),
						},
					],
				}),
				signal: AbortSignal.timeout(8000),
			},
		);
		if (!response.ok) continue;
		const body = await response.json();
		const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}");
		if (isPlacements(parsed.placements)) return parsed.placements;
	}
	return null;
}

export async function POST(request: Request) {
	const session = await auth();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const body = await request.json().catch(() => null);
	if (!body || !isRoom(body.room) || !isPlacements(body.placements)) {
		return NextResponse.json(
			{ error: "Invalid room/placements payload" },
			{ status: 400 },
		);
	}
	const weights = validWeights(body.weights);
	let proposed = null;
	try {
		proposed = await askModel(body.room, body.placements);
	} catch {
		proposed = null;
	}
	const placements = proposed ?? relationFallback(body.room, body.placements);
	const ranked = optimizeLayout(body.room, placements, weights);
	return NextResponse.json({
		source: proposed ? "llm" : "local-fallback",
		placements,
		options: ranked,
	});
}
