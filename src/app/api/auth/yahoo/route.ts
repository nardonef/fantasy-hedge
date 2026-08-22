import { auth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const YAHOO_AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  const clientId = process.env.YAHOO_CLIENT_ID;
  if (!clientId) {
    return new NextResponse("Yahoo OAuth not configured", { status: 500 });
  }

  const redirectUri = new URL("/api/auth/yahoo/callback", req.url).toString();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "fspt-r",
    state: userId,
  });

  return NextResponse.redirect(`${YAHOO_AUTH_URL}?${params.toString()}`);
}
