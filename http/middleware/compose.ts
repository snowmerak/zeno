/**
 * @zeno/http - Middleware Composer
 *
 * Fiber/Koa-style compose with afterware support.
 * Supports variadic registration: app.get(path, mw1, mw2, handler)
 */

import type { Context, Handler, Middleware, Next } from "../types.ts";

/**
 * Composes an array of middlewares + final handler into one function.
 */
export function compose(
  middlewares: Middleware[],
  handler: Handler
): (ctx: Context) => Promise<Response | void> {
  const fns: Middleware[] = [
    ...middlewares,
    wrapHandler(handler),
  ];

  return function composed(ctx: Context): Promise<Response | void> {
    let index = -1;

    const dispatch = async (i: number): Promise<Response | void> => {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;

      const fn = fns[i];
      if (!fn) {
        return;
      }

      const next: Next = () => dispatch(i + 1);
      const result = await fn(ctx, next);

      // If this layer returned a Response, propagate it up (important for afterware)
      if (result instanceof Response) {
        return result;
      }

      return result;
    };

    return dispatch(0);
  };
}

function wrapHandler(handler: Handler): Middleware {
  return async (ctx, next) => {
    const result = await handler(ctx);
    if (result instanceof Response) {
      return result;
    }
    // If handler didn't return Response, continue (allows afterware)
    return next();
  };
}

/**
 * Normalize variadic handler arguments.
 * Last argument is treated as the final handler.
 */
export function normalizeHandlers(
  handlers: (Middleware | Handler)[]
): { middlewares: Middleware[]; handler: Handler } {
  if (handlers.length === 0) {
    throw new Error("Route requires at least one handler");
  }

  const last = handlers[handlers.length - 1] as Handler;
  const middlewares = handlers.slice(0, -1) as Middleware[];

  return { middlewares, handler: last };
}
