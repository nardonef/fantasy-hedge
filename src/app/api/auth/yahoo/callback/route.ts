import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { providerAccounts, users } from "@/db/schema";
import { ingestLeagueBundle } from "@/lib/ingest-league-bundle";
import { exchangeYahooAuthorizationCode, YAHOO_OAUTH_STATE_COOKIE } from "@/lib/yahoo-oauth";
import { createHttpYahooApi, fetchYahooLeagueBundles } from "@/providers/yahoo";

function failure(message: string, status: number) {
  return new NextResponse(message, { status });
}

export async function GET(req: NextRequest) {
  // The connecting user is always the current session, never a value from the URL — `state`
  // is checked only as a CSRF token (does this request's browser match the one that started
  // the flow?), not trusted as identity.
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return failure("Not signed in", 401);

  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");
  const returnedState = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(YAHOO_OAUTH_STATE_COOKIE)?.value;

  if (error) return failure(`Yahoo authorization failed: ${error}`, 400);
  if (!code) return failure("Missing authorization code", 400);
  if (!expectedState || !returnedState || returnedState !== expectedState) {
    return failure("Invalid or expired OAuth state — please try connecting again", 400);
  }

  const [dbUser] = await db.select().from(users).where(eq(users.clerkId, clerkUserId)).limit(1);
  if (!dbUser) return failure("No account found for the connecting user", 400);

  const redirectUri = new URL("/api/auth/yahoo/callback", req.url).toString();
  const tokens = await exchangeYahooAuthorizationCode(code, redirectUri);
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  // Yahoo's token response carries the user's GUID under a couple of possible field names;
  // fall back to the Clerk id so the row still has a stable providerUserId.
  const tokenPayload = tokens as unknown as Record<string, unknown>;
  const yahooGuid =
    (typeof tokenPayload.xoauth_yahoo_guid === "string" && tokenPayload.xoauth_yahoo_guid) ||
    clerkUserId;

  const [account] = await db
    .insert(providerAccounts)
    .values({
      userId: dbUser.id,
      provider: "yahoo",
      providerUserId: yahooGuid,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry,
    })
    .onConflictDoUpdate({
      target: [providerAccounts.provider, providerAccounts.providerUserId],
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiry,
        userId: dbUser.id,
        updatedAt: new Date(),
      },
    })
    .returning();

  const bundles = await fetchYahooLeagueBundles(createHttpYahooApi(tokens.access_token));
  for (const bundle of bundles) {
    await ingestLeagueBundle(account.id, bundle);
  }

  const response = NextResponse.redirect(new URL("/connect/yahoo/success", req.url));
  response.cookies.delete(YAHOO_OAUTH_STATE_COOKIE);
  return response;
}
