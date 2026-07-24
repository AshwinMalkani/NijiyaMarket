import { Hono } from "hono";
import type { Env, Vars } from "./types";
import { authRoutes } from "./auth";
import { api } from "./api";
import { servePhoto } from "./photos";

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.route("/api/auth", authRoutes);
app.route("/api", api);

app.get("/img/*", async (c) => {
  const key = decodeURIComponent(new URL(c.req.url).pathname.slice("/img/".length));
  return servePhoto(c.env, key);
});

app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json({ error: "Something went wrong" }, 500);
});

// Everything else is the React app (Workers Assets falls back to index.html).
app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
