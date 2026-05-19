import { createHash } from "node:crypto";

/**
 * Compute a strong ETag for the given input.
 *
 * Format: `"<hex-length>-<base64-sha1>"` — same shape as Node's `etag` module,
 * compatible with most HTTP frameworks.
 */
export function etag(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  if (buf.length === 0) {
    // SHA-1 of empty input, base64-trimmed to 27 chars
    return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  }
  const hash = createHash("sha1").update(buf).digest("base64").slice(0, 27);
  return `"${buf.length.toString(16)}-${hash}"`;
}

/** Weak variant: `W/"..."`. Use when bytewise equality isn't important. */
export function weakEtag(input: string | Buffer): string {
  return `W/${etag(input)}`;
}

/**
 * Compute an ETag from a `Buffer` representing file stats: length + mtime.
 * Cheap and stable, ideal for files where content hashing is overkill.
 */
export function statEtag(size: number, mtimeMs: number, weak = false): string {
  if (!Number.isFinite(size) || size < 0) throw new Error("invalid size");
  if (!Number.isFinite(mtimeMs)) throw new Error("invalid mtimeMs");
  const tag = `"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
  return weak ? `W/${tag}` : tag;
}

/**
 * Stream-friendly ETag: consumes the entire stream and returns an ETag of its
 * contents. Works with both Node `Readable` streams and Web `ReadableStream`.
 */
export async function etagStream(stream: AsyncIterable<Uint8Array | Buffer>): Promise<string> {
  const hash = createHash("sha1");
  let length = 0;
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buf.length;
    hash.update(buf);
  }
  if (length === 0) return '"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"';
  return `"${length.toString(16)}-${hash.digest("base64").slice(0, 27)}"`;
}

/* ----- Conditional request helpers ----- */

function parseList(header: string | undefined | null): string[] | "*" {
  if (header === undefined || header === null || header === "") return [];
  const trimmed = header.trim();
  if (trimmed === "*") return "*";
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Compare two ETag values, optionally treating weak ETags as equivalent.
 *
 * - `strong: false` (default) → both `"abc"` and `W/"abc"` match.
 * - `strong: true` → only `"abc"` matches `"abc"` (weak excluded).
 */
export function tagsEqual(a: string, b: string, opts: { strong?: boolean } = {}): boolean {
  if (opts.strong) {
    if (a.startsWith("W/") || b.startsWith("W/")) return false;
    return a === b;
  }
  const norm = (x: string) => (x.startsWith("W/") ? x.slice(2) : x);
  return norm(a) === norm(b);
}

/**
 * Evaluate an `If-Match` header. Returns true when the request should proceed.
 *
 * - Absent or empty header → true (no precondition).
 * - `*` → true if any representation exists (we treat current as existing).
 * - Otherwise → true if `currentEtag` strongly matches any listed tag.
 */
export function ifMatch(header: string | undefined, currentEtag: string): boolean {
  const list = parseList(header);
  if (list === "*") return true;
  if (!list.length) return true;
  return list.some((tag) => tagsEqual(tag, currentEtag, { strong: true }));
}

/**
 * Evaluate an `If-None-Match` header. Returns true when the request should proceed
 * (i.e. resource has changed; the server should serve the response).
 *
 * Returns false when caller's cached representation is current (server should
 * reply with 304 Not Modified).
 */
export function ifNoneMatch(header: string | undefined, currentEtag: string): boolean {
  const list = parseList(header);
  if (list === "*") return false;
  if (!list.length) return true;
  return !list.some((tag) => tagsEqual(tag, currentEtag));
}
