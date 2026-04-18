import { describe, it, expect } from "vitest";
import { parseDbJson } from "../../src/utils/parseDbJson";

describe("parseDbJson", () => {
  it("returns null for null input", () => {
    expect(parseDbJson(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(parseDbJson(undefined)).toBeNull();
  });

  it("parses a JSON string into the expected object", () => {
    expect(parseDbJson('{"k":"v","n":3}')).toEqual({ k: "v", n: 3 });
  });

  it("returns the already-parsed object unchanged when mysql2 gives an object", () => {
    const obj = { k: "v", nested: { a: 1 } };
    expect(parseDbJson(obj)).toBe(obj);
  });

  it("returns an already-parsed array unchanged", () => {
    const arr = [1, 2, 3];
    expect(parseDbJson(arr)).toBe(arr);
  });

  it("returns the raw string when the payload is not valid JSON (opaque fallback)", () => {
    // This intentionally exercises the catch branch: the caller sometimes
    // stores opaque text in a JSON-shaped column; we preserve it.
    expect(parseDbJson("not-json")).toBe("not-json");
  });

  it("respects the generic type parameter (compile-time only, smoke test)", () => {
    type Shape = { code: string };
    const parsed = parseDbJson<Shape>('{"code":"ABC"}');
    expect(parsed).not.toBeNull();
    expect(parsed!.code).toBe("ABC");
  });
});
