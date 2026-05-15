import { Hono } from "hono";

type Bindings = Record<string, never>;

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
