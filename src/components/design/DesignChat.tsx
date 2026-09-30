"use client";

import { useEffect, useRef } from "react";
import { useChatStore } from "@/lib/design/chatStore";
import { useDesignStore } from "@/lib/design/store";

export function DesignChat() {
	const room = useDesignStore((state) => state.room);
	const placements = useDesignStore((state) => state.placements);
	const applyPlacements = useDesignStore((state) => state.applyPlacements);
	const applyRoom = useDesignStore((state) => state.applyRoom);
	const messages = useChatStore((state) => state.messages);
	const message = useChatStore((state) => state.draft);
	const options = useChatStore((state) => state.options);
	const activeOption = useChatStore((state) => state.activeOption);
	const status = useChatStore((state) => state.status);
	const error = useChatStore((state) => state.error);
	const addMessage = useChatStore((state) => state.addMessage);
	const update = useChatStore((state) => state.update);
	const setMessage = (draft: string) => update({ draft });
	const setActiveOption = (activeOption: number) => update({ activeOption });
	const messagesRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: scroll whenever the thread changes
	useEffect(() => {
		messagesRef.current?.scrollTo({
			top: messagesRef.current.scrollHeight,
			behavior: "smooth",
		});
	}, [messages, status]);

	async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const request = message.trim();
		if (!request || status === "sending") return;
		update({ draft: "", error: null, status: "sending" });
		addMessage({ role: "user", text: request });
		try {
			const response = await fetch("/api/layout/chat", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					room,
					placements,
					message: request,
					// Skip the canned greeting; the server caps history length.
					history: messages.slice(1),
				}),
			});
			const data = await response.json();
			if (!response.ok)
				throw new Error(data.error ?? "The design assistant could not respond");
			addMessage({ role: "assistant", text: data.reply });
			if (data.room) applyRoom(data.room);
			if (Array.isArray(data.placements)) applyPlacements(data.placements);
			update({ options: data.options ?? [], activeOption: 0 });
		} catch (chatError) {
			update({
				error:
					chatError instanceof Error
						? chatError.message
						: "The design assistant could not respond",
			});
		} finally {
			update({ status: "idle" });
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
					{status === "sending" ? "Thinking" : "Ready"}
				</span>
			</div>
			<div className="chat-messages" aria-live="polite" ref={messagesRef}>
				{messages.map((item, index) => (
					<p
						key={`${item.role}-${index}`}
						className={`chat-message ${item.role}`}
					>
						{item.text}
					</p>
				))}
				{status === "sending" && (
					<p className="chat-message assistant is-typing">
						<span />
						<span />
						<span />
						<span className="sr-only">Designing your room...</span>
					</p>
				)}
			</div>
			<form className="chat-form" onSubmit={sendMessage}>
				<label htmlFor="design-request">Your requirements</label>
				<textarea
					id="design-request"
					value={message}
					onChange={(event) => setMessage(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && !event.shiftKey) {
							event.preventDefault();
							event.currentTarget.form?.requestSubmit();
						}
					}}
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
							className={index === activeOption ? "active" : undefined}
							aria-pressed={index === activeOption}
							onClick={() => {
								applyPlacements(option.placements);
								setActiveOption(index);
							}}
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
