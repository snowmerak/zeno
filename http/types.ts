/**
 * @zeno/http - Core Types
 *
 * Fiber-like handler architecture: Everything is Promise-based.
 * Middleware supports variadic registration and automatic composition.
 */

import type { Context } from "./context.ts";
export type { Context };

/**
 * The final handler for a route.
 * Must return Promise (no sync handlers allowed).
 */
export type Handler = (ctx: Context) => Promise<Response | void>;

/**
 * Next function passed to middleware.
 */
export type Next = () => Promise<Response | void>;

/**
 * Middleware function.
 * Can run logic before and after calling `next()` (afterware friendly).
 */
export type Middleware = (ctx: Context, next: Next) => Promise<Response | void>;

/**
 * Anything that can be registered as part of a route handler chain.
 */
export type HandlerLike = Middleware | Handler;

/**
 * Internal representation of a registered route.
 */
export interface Route {
  method: string; // "GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", or "ALL"
  path: string;
  handlers: HandlerLike[];
}

/**
 * Result of matching a request against the router.
 */
export interface RouteMatch {
  route: Route;
  params: Record<string, string>;
}
