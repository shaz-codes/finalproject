import { NextResponse } from "next/server";
import { isPlacements, isRoom } from "@/lib/design/validate";
import { prisma } from "@/lib/prisma";
import { auth } from "../../../../../auth";

async function loadOwnedDesign(id: string, userId: string) {
	const design = await prisma.design.findUnique({ where: { id } });
	if (!design || design.userId !== userId) return null;
	return design;
}

export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const design = await loadOwnedDesign(id, session.user.id);
	if (!design)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

	return NextResponse.json({ design });
}

export async function PUT(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const existing = await loadOwnedDesign(id, session.user.id);
	if (!existing)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

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
			: existing.name;

	const design = await prisma.design.update({
		where: { id },
		data: { name, room: body.room, placements: body.placements },
		select: { id: true, name: true, createdAt: true, updatedAt: true },
	});
	return NextResponse.json({ design });
}

export async function DELETE(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const session = await auth();
	if (!session)
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { id } = await params;
	const existing = await loadOwnedDesign(id, session.user.id);
	if (!existing)
		return NextResponse.json({ error: "Not found" }, { status: 404 });

	await prisma.design.delete({ where: { id } });
	return NextResponse.json({ ok: true });
}
