# etag

[![ci](https://github.com/p-vbordei/etag/actions/workflows/ci.yml/badge.svg)](https://github.com/p-vbordei/etag/actions/workflows/ci.yml)

[![npm](https://img.shields.io/npm/v/etag-mini.svg)](https://www.npmjs.com/package/etag-mini)
[![downloads](https://img.shields.io/npm/dm/etag-mini.svg)](https://www.npmjs.com/package/etag-mini)
[![bundle](https://img.shields.io/bundlejs/size/etag-mini)](https://bundlejs.com/?q=etag-mini)

Compute strong/weak ETags for strings, Buffers, and streams. Plus conditional-request helpers (`If-Match`, `If-None-Match`). Zero dependencies; uses Node's built-in `crypto`.

```ts
import { etag, weakEtag, statEtag, etagStream, ifMatch, ifNoneMatch } from "etag-mini";

etag("hello world")               // '"b-Kq5sNclPz7QV2+lfQIuc6R7oRu0"'
weakEtag("hello world")           // 'W/"b-Kq5sNclPz7QV2+lfQIuc6R7oRu0"'

// Stream-friendly (Node Readable or async-iterable of Buffers/Uint8Arrays)
await etagStream(fs.createReadStream("file"));

// Cheap file ETag from stat() info
statEtag(stat.size, stat.mtimeMs);

// Conditional request evaluation
ifNoneMatch(req.headers["if-none-match"], currentEtag);
// → false means "respond 304 Not Modified"
```

## Install

```sh
npm install etag-mini
```

> The npm name is `etag-mini` because `etag` is already taken on npm. The GitHub repo is `etag`.

## API

### Compute

- `etag(stringOrBuffer): string` — `"<hex-length>-<base64-sha1>"`, compatible with the Node `etag` package
- `weakEtag(stringOrBuffer): string` — prefixed `W/`
- `statEtag(size, mtimeMs, weak?): string` — cheap content-free ETag from stat data
- `etagStream(asyncIterable<Buffer|Uint8Array>): Promise<string>` — works with Node Readable, Web ReadableStream, generators

### Compare

- `tagsEqual(a, b, opts?: { strong?: boolean }): boolean` — weak/strong-aware
- `ifMatch(header, currentEtag): boolean` — `true` → proceed
- `ifNoneMatch(header, currentEtag): boolean` — `false` → reply 304

`ifMatch` requires **strong** equality (per RFC 7232); `ifNoneMatch` treats weak and strong as equivalent by default (also per RFC).

## License

Apache-2.0 © Vlad Bordei
