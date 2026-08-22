import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { providerAccounts } from "@/db/schema";

const YAHOO_TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

function getYahooConfig() {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Yahoo OAuth not configured — set YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET");
  }
  return { clientId, clientSecret };
}

type TokenResponse = { access_token: string; refresh_token: string; expires_in: number };

async function exchangeYahooToken(body: URLSearchParams): Promise<TokenResponse> {
  const { clientId, clientSecret } = getYahooConfig();
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(YAHOO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Yahoo token request failed: ${res.status} ${await res.text()}`);
  }
  return res.json() as Promise<TokenResponse>;
}

export function exchangeYahooAuthorizationCode(code: string, redirectUri: string) {
  return exchangeYahooToken(
    new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }),
  );
}

/**
 * Returns a valid Yahoo access token for a user, auto-refreshing if expired. Returns null if
 * no Yahoo account is connected. Throws if refresh fails — the caller should ask the user to
 * reconnect Yahoo rather than silently degrade.
 */
export async function getValidYahooToken(userId: string): Promise<string | null> {
  const [account] = await db
    .select()
    .from(providerAccounts)
    .where(and(eq(providerAccounts.userId, userId), eq(providerAccounts.provider, "yahoo")))
    .limit(1);

  if (!account?.accessToken) return null;

  const isExpired = account.tokenExpiry ? account.tokenExpiry < new Date() : false;
  if (!isExpired) return account.accessToken;

  if (!account.refreshToken) {
    throw new Error("Yahoo token expired and no refresh token available. Please reconnect Yahoo.");
  }

  const tokens = await exchangeYahooToken(
    new URLSearchParams({ grant_type: "refresh_token", refresh_token: account.refreshToken }),
  );
  const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000);

  await db
    .update(providerAccounts)
    .set({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiry,
      updatedAt: new Date(),
    })
    .where(eq(providerAccounts.id, account.id));

  return tokens.access_token;
}
