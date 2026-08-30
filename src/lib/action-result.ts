/**
 * Next.js redacts a Server Action's thrown Error message in production builds (replaced with
 * a generic "Minified React error #441" placeholder plus an opaque digest, by design — a
 * thrown error is treated as an unexpected crash, not something safe to show the user). A
 * plain returned value has no such redaction. Every server action that can fail in a way the
 * user should see (not signed in, insufficient balance, market already settled, ...) must
 * return an ActionResult instead of throwing, or that message never reaches the client outside
 * local dev.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Runs fn, converting any thrown Error into an ActionResult instead of letting it propagate. */
export async function toActionResult<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Something went wrong" };
  }
}
