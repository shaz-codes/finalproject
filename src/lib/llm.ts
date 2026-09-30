// Server-only helper for OpenAI-compatible chat completion APIs.

export type LlmMessage = {
	role: "system" | "user" | "assistant";
	content: string;
};

function chatCompletionsUrl() {
	const base = (process.env.OPENAI_API_URL ?? "https://api.openai.com").replace(
		/\/+$/,
		"",
	);
	if (base.endsWith("/chat/completions")) return base;
	return /\/v\d+$/.test(base)
		? `${base}/chat/completions`
		: `${base}/v1/chat/completions`;
}

/**
 * Sends `messages` and returns the parsed JSON object the model replied with.
 * `buildMessages` receives the attempt number so retries can add a correction hint.
 * Returns null when no API key is configured or every attempt fails validation.
 */
export async function requestJson<T>(
	buildMessages: (attempt: number) => LlmMessage[],
	validate: (value: unknown) => T | null,
	{ attempts = 2, temperature = 0.3 } = {},
): Promise<T | null> {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;
	const reasoningEffort = process.env.OPENAI_REASONING_EFFORT;
	// Reasoning models can take 20-70s; one deadline covers the retries too.
	const signal = AbortSignal.timeout(120000);
	for (let attempt = 0; attempt < attempts; attempt += 1) {
		const response = await fetch(chatCompletionsUrl(), {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
				temperature,
				response_format: { type: "json_object" },
				...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
				messages: buildMessages(attempt),
			}),
			signal,
		});
		if (!response.ok) {
			console.error(
				`LLM request failed (${response.status}):`,
				(await response.text().catch(() => "")).slice(0, 300),
			);
			continue;
		}
		const body = await response.json();
		try {
			const result = validate(
				JSON.parse(body.choices?.[0]?.message?.content ?? "{}"),
			);
			if (result !== null) return result;
			console.error("LLM returned an unexpected shape");
		} catch {
			console.error("LLM returned invalid JSON");
		}
	}
	return null;
}
