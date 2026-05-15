import { describe, expect, test } from "bun:test";
import app from "../src/index.ts";

describe("GET /api/health", () => {
  test("returns 200 with { ok: true }", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});
