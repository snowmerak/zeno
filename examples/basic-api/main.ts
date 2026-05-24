/**
 * @zeno/http Basic Example
 *
 * Shows Fiber-like usage:
 * - .get, .post
 * - .handle(method, path, ...)
 * - Global middleware
 * - Route-level middleware (variadic)
 * - Promise-only handlers
 */

import { createApp, Middleware, type Context } from "../../http/mod.ts";

const app = createApp();

// Global middleware example
const requestLogger: Middleware = async (ctx, next) => {
  const start = performance.now();
  console.log(`→ ${ctx.req.method} ${new URL(ctx.req.url).pathname}`);

  const res = await next();

  const duration = (performance.now() - start).toFixed(1);
  console.log(`← ${ctx.req.method} ${new URL(ctx.req.url).pathname} (${duration}ms)`);

  return res; // Important: return the Response from next()
};

app.use(requestLogger);

// Simple route
app.get("/", async (ctx: Context) => {
  return ctx.text("Hello from @zeno/http! (Fiber-like)");
});

// Demonstrate new Context helpers
app.get("/redirect", async (ctx: Context) => {
  return ctx.redirect("https://deno.com", 302);
});

app.get("/html-demo", async (ctx: Context) => {
  ctx.status(200);
  return ctx.html("<h1>Hello from html() helper</h1>");
});

// Cookie demo
app.get("/set-cookie", async (ctx: Context) => {
  ctx.setCookie("zeno-session", "abc123", { httpOnly: true, path: "/" });
  return ctx.text("Cookie set! Check your cookies.");
});

app.get("/get-cookie", async (ctx: Context) => {
  const session = ctx.getCookie("zeno-session");
  return ctx.json({ session: session ?? "no cookie found" });
});

// Route with param
app.get("/users/:id", async (ctx: Context) => {
  return ctx.json({
    id: ctx.params.id,
    message: "User fetched successfully",
  });
});

// Using .handle (Fiber style)
app.handle("POST", "/echo", async (ctx: Context) => {
  const body = await ctx.req.json().catch(() => ({}));
  return ctx.json({ received: body, method: "POST via .handle" });
});

// Route with middleware (variadic)
const fakeAuth: Middleware = async (ctx, next) => {
  const auth = ctx.req.headers.get("authorization");
  if (!auth) {
    return ctx.text("Unauthorized", { status: 401 });
  }
  // You could attach user info to ctx here in real impl
  return next();
};

app.get("/protected", fakeAuth, async (ctx: Context) => {
  return ctx.json({ secret: "this is protected data" });
});

// DELETE route
app.delete("/users/:id", async (ctx: Context) => {
  return ctx.json({ deleted: ctx.params.id, success: true });
});

// PUT route (update)
app.put("/users/:id", async (ctx: Context) => {
  const body = await ctx.req.json().catch(() => ({}));
  return ctx.json({
    updated: ctx.params.id,
    data: body,
    success: true,
  });
});

// Query parameter demo
app.get("/search", async (ctx: Context) => {
  const q = ctx.query.get("q") ?? "";
  const limit = ctx.query.get("limit") ?? "10";
  return ctx.json({
    query: q,
    limit: parseInt(limit),
    results: [`result for ${q}`],
  });
});

// POST with body (create)
app.post("/users", async (ctx: Context) => {
  const body = await ctx.req.json().catch(() => ({}));
  ctx.status(201);
  return ctx.json({
    created: true,
    user: body,
  });
});

// Demonstrate throwing error (will be caught by onError if set)
app.get("/error", async () => {
  throw new Error("This is a demo error");
});

console.log("🚀 @zeno/http example running at http://localhost:8000");
console.log("");
console.log("Try:");
console.log("  curl http://localhost:8000/");
console.log("  curl http://localhost:8000/users/42");
console.log("  curl -X POST http://localhost:8000/echo -H 'Content-Type: application/json' -d '{\"hello\":\"world\"}'");
console.log("  curl -H 'Authorization: Bearer xxx' http://localhost:8000/protected");
console.log("  curl -X DELETE http://localhost:8000/users/42");
console.log("  curl -X PUT http://localhost:8000/users/42 -H 'Content-Type: application/json' -d '{\"name\":\"new\"}'");
console.log("  curl 'http://localhost:8000/search?q=deno&limit=5'");
console.log("  curl -X POST http://localhost:8000/users -H 'Content-Type: application/json' -d '{\"name\":\"snow\"}'");

const port = Number(Deno.env.get("PORT") || 8000);

try {
  Deno.serve({ port }, app.fetch);
} catch (err) {
  if (err instanceof Deno.errors.AddrInUse) {
    console.error(`Port ${port} is already in use. Try: PORT=8001 deno task dev`);
  } else {
    throw err;
  }
}
