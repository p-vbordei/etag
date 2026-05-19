# etag

[![ci](https://github.com/p-vbordei/etag/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/etag/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/etag-mini.svg)](https://www.npmjs.com/package/etag-mini)
[![downloads](https://img.shields.io/npm/dm/etag-mini.svg)](https://www.npmjs.com/package/etag-mini)
[![bundle](https://img.shields.io/bundlejs/size/etag-mini)](https://bundlejs.com/?q=etag-mini)

> Compute strong/weak ETags for strings, Buffers, and streams. Plus conditional-request helpers. Zero dependencies; uses Node's built-in `crypto`.

```ts
import { etag, weakEtag, statEtag, etagStream, ifMatch, ifNoneMatch } from "etag-mini";

etag("hello world")               // '"b-Kq5sNclPz7QV2+lfQIuc6R7oRu0"'
await etagStream(fs.createReadStream("file"));
statEtag(stat.size, stat.mtimeMs);

ifNoneMatch(req.headers["if-none-match"], currentEtag);
// → false means "respond 304 Not Modified"
```

## Install

```sh
npm install etag-mini
```

> The npm name is `etag-mini` because `etag` is already taken on npm. The GitHub repo is `etag`.

Works with Node 20+ (uses `node:crypto`). ESM + CJS.

## Why

ETags are HTTP's content-fingerprint header. Used right, they:

- Save bandwidth — clients with a fresh copy get `304 Not Modified` (empty body) instead of re-downloading.
- Enable optimistic concurrency — `If-Match` ensures you don't overwrite changes you didn't know about.

`etag-mini` covers both directions: **compute** ETags and **evaluate** conditional request headers per RFC 7232. Most existing libraries do half the job — `etag` computes but doesn't evaluate; `fresh` evaluates but doesn't compute streams. This is both, ~150 lines.

## Recipes

### Conditional response in plain `http`

```ts
import { etag, ifNoneMatch } from "etag-mini";
import { createServer } from "node:http";

createServer((req, res) => {
  const body = renderPage();
  const tag = etag(body);
  res.setHeader("ETag", tag);

  if (!ifNoneMatch(req.headers["if-none-match"], tag)) {
    res.statusCode = 304;
    res.end();
    return;
  }
  res.setHeader("Content-Type", "text/html");
  res.end(body);
}).listen(3000);
```

### Static file with stat-based ETag

```ts
import { statEtag, ifNoneMatch } from "etag-mini";
import { promises as fsp, createReadStream } from "node:fs";

const s = await fsp.stat(filepath);
const tag = statEtag(s.size, s.mtimeMs);
res.setHeader("ETag", tag);

if (!ifNoneMatch(req.headers["if-none-match"], tag)) {
  res.statusCode = 304;
  return res.end();
}
createReadStream(filepath).pipe(res);
```

### Optimistic concurrency on PUT

```ts
import { etag, ifMatch } from "etag-mini";

async function updateDoc(req, res) {
  const current = await db.get(id);
  const currentTag = etag(JSON.stringify(current));

  if (!ifMatch(req.headers["if-match"], currentTag)) {
    res.statusCode = 412;
    return res.end("Precondition Failed — document changed since you read it");
  }

  await db.update(id, await readJsonBody(req));
  res.setHeader("ETag", etag(JSON.stringify(await db.get(id))));
  res.end();
}
```

### Stream ETag for large files

```ts
import { etagStream } from "etag-mini";
import { createReadStream } from "node:fs";

const tag = await etagStream(createReadStream(largeFile));
// Hashes lazily without buffering the whole file
```

## API

### Compute

- `etag(stringOrBuffer): string` — `"<hex-length>-<base64-sha1>"`, compatible with the Node `etag` package
- `weakEtag(stringOrBuffer): string` — prefixed `W/`
- `statEtag(size, mtimeMs, weak?): string` — cheap content-free ETag from stat data
- `etagStream(asyncIterable<Buffer|Uint8Array>): Promise<string>` — works with Node `Readable`, Web `ReadableStream`, generators

### Compare

- `tagsEqual(a, b, opts?: { strong?: boolean }): boolean` — weak/strong-aware
- `ifMatch(header, currentEtag): boolean` — `true` → proceed
- `ifNoneMatch(header, currentEtag): boolean` — `false` → reply 304

`ifMatch` requires **strong** equality (per RFC 7232); `ifNoneMatch` treats weak and strong as equivalent by default (also per RFC).

## Strong vs weak

A **strong** ETag changes when bytes change. Two responses with the same strong ETag are byte-for-byte identical.

A **weak** ETag (`W/"..."`) changes when semantic content changes — different whitespace, different gzip encoding could share a weak ETag. Use weak when generating ETags from content metadata (size+mtime, hash of a model object) rather than from the served bytes.

`ifMatch` for PUT-style writes wants strong equivalence. `ifNoneMatch` for GET caching is fine with weak equivalence.

## Caveats

- **SHA-1 isn't cryptographically strong anymore.** Fine for ETags — collision resistance for caching isn't a security property.
- **No tag normalization for user-supplied headers.** Per spec, ETag headers should be quoted; if a buggy client sends `If-None-Match: abc` (no quotes), comparison fails.

## License

Apache-2.0 © Vlad Bordei
