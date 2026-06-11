import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "./index";

export async function requireStaff() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), session: null };
  }
  if (!(session.user as { isStaff?: boolean }).isStaff) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), session: null };
  }
  return { error: null, session };
}
