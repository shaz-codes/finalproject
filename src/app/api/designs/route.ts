import { NextResponse } from "next/server";
import { isPlacements, isRoom } from "@/lib/design/validate";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../auth";

export async function GET() {
	const session = await auth();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const designs = await prisma.design.findMany({
		where: { userId: session.user.id },
		select: { id: true, name: true, createdAt: true, updatedAt: true },
		orderBy: { updatedAt: "desc" },
	});
	return NextResponse.json({ designs });
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
	const name =
		typeof body.name === "string" && body.name.trim()
			? body.name.trim()
			: "Untitled room";

	const design = await prisma.design.create({
		data: {
			userId: session.user.id,
			name,
			room: body.room,
			placements: body.placements,
		},
		select: { id: true, name: true, createdAt: true, updatedAt: true },
	});
	return NextResponse.json({ design }, { status: 201 });
}
