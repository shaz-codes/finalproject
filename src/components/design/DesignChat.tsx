"use client";

import { useState } from "react";
import type { LayoutOption } from "@/lib/design/optimizer";
import { useDesignStore } from "@/lib/design/store";

type Message = { role: "assistant" | "user"; text: string };

export function DesignChat() {
	const room = useDesignStore((state) => state.room);
	const placements = useDesignStore((state) => state.placements);
	const applyPlacements = useDesignStore((state) => state.applyPlacements);
	const [message, setMessage] = useState("");
	const [messages, setMessages] = useState<Message[]>([
		{
			role: "assistant",
			text: "Tell me what you need in this room. For example: add a sofa and coffee table, keep a clear walkway, or prioritize Vastu.",
		},
	]);
	const [options, setOptions] = useState<LayoutOption[]>([]);
	const [status, setStatus] = useState<"idle" | "sending">("idle");
	const [error, setError] = useState<string | null>(null);

	async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const request = message.trim();
		if (!request || status === "sending") return;
		setMessage("");
		setError(null);
		setStatus("sending");
		setMessages((current) => [...current, { role: "user", text: request }]);
		try {
			const response = await fetch("/api/layout/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ room, placements, message: request }),
			});
			const data = await response.json();
			if (!response.ok)
				throw new Error(data.error ?? "The design assistant could not respond");
			setMessages((current) => [
				...current,
				{ role: "assistant", text: data.reply },
			]);
			setOptions(data.options ?? []);
		} catch (chatError) {
			setError(
				chatError instanceof Error
					? chatError.message
					: "The design assistant could not respond",
			);
		} finally {
			setStatus("idle");
		}
	}

	return (
		<div className="design-chat">
			<div className="chat-heading">
				<div>
					<h2>Design assistant</h2>
					<p>Describe the room you want.</p>
				</div>
				<span className="chat-status">
					{status === "sending" ? "Working" : "Ready"}
				</span>
			</div>
			<div className="chat-messages" aria-live="polite">
				{messages.map((item, index) => (
					<p
						key={`${item.role}-${index}`}
						className={`chat-message ${item.role}`}
					>
						{item.text}
					</p>
				))}
			</div>
			<form className="chat-form" onSubmit={sendMessage}>
				<label htmlFor="design-request">Your requirements</label>
				<textarea
					id="design-request"
					value={message}
					onChange={(event) => setMessage(event.target.value)}
					placeholder="e.g. Add a bed and desk, keep the center open"
					rows={3}
					disabled={status === "sending"}
				/>
				<button
					type="submit"
					disabled={!message.trim() || status === "sending"}
				>
					{status === "sending" ? "Generating..." : "Send request"}
				</button>
			</form>
			{options.length > 0 && (
				<div className="chat-options">
					<span className="chat-options-label">Suggested layouts</span>
					{options.map((option, index) => (
						<button
							type="button"
							key={`${option.label}-${index}`}
							onClick={() => applyPlacements(option.placements)}
						>
							<span>{option.label}</span>
							<strong>{Math.round(option.score.total * 100)}%</strong>
						</button>
					))}
				</div>
			)}
			{error && <p className="optimizer-error">{error}</p>}
		</div>
	);
}
