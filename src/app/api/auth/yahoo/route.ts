import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { YAHOO_OAUTH_STATE_COOKIE } from "@/lib/yahoo-oauth";

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

  // `state` is a CSRF token, not an identity carrier — the callback must not trust it to say
  // who's connecting. It only proves the callback request came from this same browser, and the
  // callback still reads the signed-in user from the actual session, not from this value.
  const state = randomBytes(32).toString("base64url");
  const redirectUri = new URL("/api/auth/yahoo/callback", req.url).toString();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "fspt-r",
    state,
  });

  const response = NextResponse.redirect(`${YAHOO_AUTH_URL}?${params.toString()}`);
  response.cookies.set(YAHOO_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/api/auth/yahoo",
  });
  return response;
}
