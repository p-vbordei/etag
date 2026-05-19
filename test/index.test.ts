import { describe, it, expect } from "vitest";
import { Readable } from "node:stream";
import { etag, weakEtag, statEtag, etagStream, tagsEqual, ifMatch, ifNoneMatch } from "../src/index.js";

describe("etag", () => {
  it("empty input has known fixed tag", () => {
    expect(etag("")).toBe('"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"');
    expect(etag(Buffer.alloc(0))).toBe('"0-2jmj7l5rSw0yVb/vlWAYkK/YBwk"');
  });

  it("deterministic", () => {
    expect(etag("hello world")).toBe(etag("hello world"));
  });

  it("changes with content", () => {
    expect(etag("a")).not.toBe(etag("b"));
  });

  it("encodes length in hex", () => {
    const t = etag("a".repeat(255));
    expect(t.startsWith('"ff-')).toBe(true);
  });

  it("works on Buffer", () => {
    expect(etag(Buffer.from("hello", "utf8"))).toBe(etag("hello"));
  });
});

describe("weakEtag", () => {
  it("prefixes with W/", () => {
    expect(weakEtag("hello")).toBe(`W/${etag("hello")}`);
  });
});

describe("statEtag", () => {
  it("strong by default", () => {
    expect(statEtag(1234, 5678)).toBe('"4d2-162e"');
  });
  it("weak when requested", () => {
    expect(statEtag(1234, 5678, true)).toBe('W/"4d2-162e"');
  });
  it("rejects invalid inputs", () => {
    expect(() => statEtag(-1, 0)).toThrow();
    expect(() => statEtag(0, NaN)).toThrow();
  });
});

describe("etagStream", () => {
  it("matches etag of joined buffers", async () => {
    const chunks = ["hello ", "world"];
    const stream = Readable.from(chunks.map((s) => Buffer.from(s, "utf8")));
    const a = await etagStream(stream);
    const b = etag("hello world");
    expect(a).toBe(b);
  });

  it("handles empty stream", async () => {
    const stream = Readable.from([]);
    expect(await etagStream(stream)).toBe(etag(""));
  });
});

describe("tagsEqual", () => {
  it("weak vs strong equivalent by default", () => {
    expect(tagsEqual('"abc"', 'W/"abc"')).toBe(true);
  });
  it("strong mode rejects weak", () => {
    expect(tagsEqual('"abc"', 'W/"abc"', { strong: true })).toBe(false);
    expect(tagsEqual('"abc"', '"abc"', { strong: true })).toBe(true);
  });
  it("different tags never match", () => {
    expect(tagsEqual('"abc"', '"xyz"')).toBe(false);
  });
});

describe("ifMatch", () => {
  it("absent header → true", () => {
    expect(ifMatch(undefined, '"abc"')).toBe(true);
  });
  it("wildcard → true", () => {
    expect(ifMatch("*", '"abc"')).toBe(true);
  });
  it("strong match returns true", () => {
    expect(ifMatch('"abc"', '"abc"')).toBe(true);
  });
  it("weak match returns false (strong required)", () => {
    expect(ifMatch('W/"abc"', '"abc"')).toBe(false);
  });
  it("list with one matching tag", () => {
    expect(ifMatch('"xyz", "abc"', '"abc"')).toBe(true);
  });
  it("no match returns false", () => {
    expect(ifMatch('"xyz"', '"abc"')).toBe(false);
  });
});

describe("ifNoneMatch", () => {
  it("absent header → true (serve response)", () => {
    expect(ifNoneMatch(undefined, '"abc"')).toBe(true);
  });
  it("wildcard with existing resource → false (304)", () => {
    expect(ifNoneMatch("*", '"abc"')).toBe(false);
  });
  it("matching tag → false (304)", () => {
    expect(ifNoneMatch('"abc"', '"abc"')).toBe(false);
  });
  it("weak tag matches by default", () => {
    expect(ifNoneMatch('W/"abc"', '"abc"')).toBe(false);
  });
  it("non-matching tag → true (changed)", () => {
    expect(ifNoneMatch('"xyz"', '"abc"')).toBe(true);
  });
});
