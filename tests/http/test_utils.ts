/**
 * Common test utilities for @zeno/http tests.
 * Helps reduce duplication and makes tests more readable.
 */

import { createApp, type Context, type Handler, type Middleware, type Router } from "../../http/mod.ts";

export interface TestRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
}

export async function makeRequest(
  app: Router,
  path: string,
  options: TestRequestOptions = {}
): Promise<Response> {
  const { method = "GET", headers = {}, body } = options;

  let requestBody: BodyInit | undefined;
  const reqHeaders = new Headers(headers);

  if (body !== undefined) {
    if (typeof body === "string") {
      requestBody = body;
    } else {
      requestBody = JSON.stringify(body);
      if (!reqHeaders.has("content-type")) {
        reqHeaders.set("content-type", "application/json");
      }
    }
  }

  const req = new Request(`http://localhost${path}`, {
    method,
    headers: reqHeaders,
    body: requestBody,
  });

  return await app.fetch(req);
}

/** Creates a fresh app with optional global middlewares pre-registered. */
export function createTestApp(...globalMiddlewares: Middleware[]): Router {
  const app = createApp();
  if (globalMiddlewares.length > 0) {
    app.use(...globalMiddlewares);
  }
  return app;
}

/** Simple middleware that sets a header (useful for testing order & composition). */
export function headerMiddleware(name: string, value: string): Middleware {
  return async (ctx, next) => {
    const res = await next();
    if (res) {
      res.headers.set(name, value);
    }
    return res;
  };
}

/** Middleware that throws (for error handling tests). */
export function throwingMiddleware(message = "boom"): Middleware {
  return async () => {
    throw new Error(message);
  };
}

/** Simple handler that returns JSON with request info. */
export function jsonEchoHandler(): Handler {
  return async (ctx: Context) => {
    return ctx.json({
      method: ctx.req.method,
      path: new URL(ctx.req.url).pathname,
      params: ctx.params,
    });
  };
}
