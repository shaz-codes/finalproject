"use client";

import { create } from "zustand";
import type { LayoutOption } from "./optimizer";

export type ChatMessage = { role: "assistant" | "user"; text: string };

// Lives outside the component so the conversation survives the editor unmounting (e.g. walkthrough).
interface ChatState {
	messages: ChatMessage[];
	draft: string;
	options: LayoutOption[];
	activeOption: number;
	status: "idle" | "sending";
	error: string | null;
	addMessage: (message: ChatMessage) => void;
	update: (
		patch: Partial<
			Pick<ChatState, "draft" | "options" | "activeOption" | "status" | "error">
		>,
	) => void;
}

export const useChatStore = create<ChatState>((set) => ({
	messages: [
		{
			role: "assistant",
			text: "Tell me what you need in this room. For example: add a sofa and coffee table, keep a clear walkway, or prioritize Vastu.",
		},
	],
	draft: "",
	options: [],
	activeOption: 0,
	status: "idle",
	error: null,
	addMessage: (message) =>
		set((state) => ({ messages: [...state.messages, message] })),
	update: (patch) => set(patch),
}));
