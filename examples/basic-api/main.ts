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

import { createApp, Middleware } from "../../http/mod.ts";

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
app.get("/", async (ctx) => {
  return ctx.text("Hello from @zeno/http! (Fiber-like)");
});

// Demonstrate new Context helpers
app.get("/redirect", async (ctx) => {
  return ctx.redirect("https://deno.com", 302);
});

app.get("/html-demo", async (ctx) => {
  ctx.status(200);
  return ctx.html("<h1>Hello from html() helper</h1>");
});

// Cookie demo
app.get("/set-cookie", async (ctx) => {
  ctx.setCookie("zeno-session", "abc123", { httpOnly: true, path: "/" });
  return ctx.text("Cookie set! Check your cookies.");
});

app.get("/get-cookie", async (ctx) => {
  const session = ctx.getCookie("zeno-session");
  return ctx.json({ session: session ?? "no cookie found" });
});

// Route with param
app.get("/users/:id", async (ctx) => {
  return ctx.json({
    id: ctx.params.id,
    message: "User fetched successfully",
  });
});

// Using .handle (Fiber style)
app.handle("POST", "/echo", async (ctx) => {
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

app.get("/protected", fakeAuth, async (ctx) => {
  return ctx.json({ secret: "this is protected data" });
});

console.log("🚀 @zeno/http example running at http://localhost:8000");
console.log("");
console.log("Try:");
console.log("  curl http://localhost:8000/");
console.log("  curl http://localhost:8000/users/42");
console.log("  curl -X POST http://localhost:8000/echo -H 'Content-Type: application/json' -d '{\"hello\":\"world\"}'");
console.log("  curl -H 'Authorization: Bearer xxx' http://localhost:8000/protected");

const port = Number(Deno.env.get("PORT") || 8000);

try {
  Deno.serve(app.fetch, { port });
} catch (err) {
  if (err instanceof Deno.errors.AddrInUse) {
    console.error(`Port ${port} is already in use. Try: PORT=8001 deno task dev`);
  } else {
    throw err;
  }
}
