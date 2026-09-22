import { NextRequest, NextResponse } from "next/server";

export function GET(req: Request, ctx: RouteContext<"/api">) {
	return NextResponse.json({ msg: "me" });
}
