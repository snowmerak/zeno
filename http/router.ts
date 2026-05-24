/**
 * @zeno/http - Router
 *
 * Fiber-inspired router with:
 * - .get, .post, .put, .patch, .delete, .handle(method)
 * - Global + route-level middleware (variadic)
 * - Promise-only handlers
 * - Uses PathTrie internally
 */

import { PathTrie } from "./trie.ts";
import { compose, normalizeHandlers } from "./middleware/compose.ts";
import type {
  Context,
  Handler,
  HandlerLike,
  Middleware,
  Route,
  RouteMatch,
} from "./types.ts";
import { createContext } from "./context.ts";

/**
 * Common interface for things that can register routes.
 * Both Router and RouterGroup will implement this.
 */
export interface IRouteRegistrar {
  use(...middlewares: Middleware[]): this;
  get(path: string, ...handlers: HandlerLike[]): this;
  post(path: string, ...handlers: HandlerLike[]): this;
  put(path: string, ...handlers: HandlerLike[]): this;
  patch(path: string, ...handlers: HandlerLike[]): this;
  delete(path: string, ...handlers: HandlerLike[]): this;
  handle(method: string, path: string, ...handlers: HandlerLike[]): this;
  notFound(handler: Handler): this;
  methodNotAllowed(handler: (ctx: Context, allowedMethods: string) => Response | Promise<Response>): this;
  group(prefix: string, fn: (router: IRouteRegistrar) => void): this;
}

export class Router implements IRouteRegistrar {
  private globalMiddlewares: Middleware[] = [];
  private routes: Route[] = [];
  private errorHandler?: (err: unknown, ctx: Context) => Response | Promise<Response>;
  private notFoundHandler?: Handler;
  private methodNotAllowedHandler?: (ctx: Context, allowedMethods: string) => Response | Promise<Response>;

  // Group별 커스텀 핸들러 (prefix → handler). 현재는 가장 긴 prefix 매칭으로 동작.
  private groupNotFoundHandlers: Map<string, Handler> = new Map();
  private groupMethodNotAllowedHandlers: Map<string, (ctx: Context, allowed: string) => Response | Promise<Response>> = new Map();

  // We use one trie per method for simplicity and performance.
  private tries: Map<string, PathTrie<Route>> = new Map();

  // path별로 어떤 HTTP 메서드가 등록되어 있는지 추적 (405 구현용)
  private pathMethods: Map<string, Set<string>> = new Map();

  /**
   * Register global middleware (applies to all routes).
   * Can be called multiple times.
   */
  use(...middlewares: Middleware[]): this {
    this.globalMiddlewares.push(...middlewares);
    return this;
  }

  // === HTTP Method shortcuts (Fiber style) ===

  get(path: string, ...handlers: HandlerLike[]): this {
    return this.addRoute("GET", path, handlers);
  }

  post(path: string, ...handlers: HandlerLike[]): this {
    return this.addRoute("POST", path, handlers);
  }

  put(path: string, ...handlers: HandlerLike[]): this {
    return this.addRoute("PUT", path, handlers);
  }

  patch(path: string, ...handlers: HandlerLike[]): this {
    return this.addRoute("PATCH", path, handlers);
  }

  delete(path: string, ...handlers: HandlerLike[]): this {
    return this.addRoute("DELETE", path, handlers);
  }

  /**
   * Register a route with explicit method string (Fiber's .handle style).
   */
  handle(method: string, path: string, ...handlers: HandlerLike[]): this {
    return this.addRoute(method.toUpperCase(), path, handlers);
  }

  // Internal method used by RouterGroup. Not intended for public use.
  _addRouteInternal(method: string, path: string, handlers: HandlerLike[]): this {
    return this.addRoute(method, path, handlers);
  }

  private addRoute(method: string, path: string, handlers: HandlerLike[]): this {
    const { middlewares, handler } = normalizeHandlers(handlers);

    const route: Route = {
      method,
      path,
      handlers: [...middlewares, handler],
    };

    this.routes.push(route);

    // Trie 등록
    if (!this.tries.has(method)) {
      this.tries.set(method, new PathTrie<Route>());
    }
    this.tries.get(method)!.insert(path, route);

    // 405 지원을 위한 path별 method 추적
    if (!this.pathMethods.has(path)) {
      this.pathMethods.set(path, new Set());
    }
    this.pathMethods.get(path)!.add(method);

    return this;
  }

  /**
   * Main entry point. Use this as Deno.serve handler.
   */
  fetch = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);
    const method = req.method;

    // Try exact method first
    let match = this.findRoute(method, url.pathname);

    // Fallback to "ALL" if we support it later
    if (!match) {
      match = this.findRoute("ALL", url.pathname);
    }

    // For 404/405 cases, we still create a Context (with empty params)
    const ctx = createContext(req, match?.params ?? {});

    if (!match) {
      const registeredMethods = this.pathMethods.get(url.pathname);

      if (registeredMethods && registeredMethods.size > 0) {
        // 405 Method Not Allowed
        const allow = Array.from(registeredMethods).sort().join(", ");

        // Group-specific methodNotAllowed 우선 (가장 구체적인 prefix)
        const groupMA = this._findBestGroupHandler(url.pathname, this.groupMethodNotAllowedHandlers);
        if (groupMA) {
          const res = await groupMA(ctx, allow);
          if (res instanceof Response) {
            res.headers.set("Allow", allow);
            return res;
          }
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { Allow: allow },
          });
        }

        if (this.methodNotAllowedHandler) {
          const res = await this.methodNotAllowedHandler(ctx, allow);
          if (res instanceof Response) {
            res.headers.set("Allow", allow);
            return res;
          }
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { Allow: allow },
          });
        }

        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: allow },
        });
      }

      // 404 Not Found - Group specific 우선
      const groupNF = this._findBestGroupHandler(url.pathname, this.groupNotFoundHandlers);
      if (groupNF) {
        const res = await groupNF(ctx);
        if (res instanceof Response) return res;
        return new Response("Not Found", { status: 404 });
      }

      if (this.notFoundHandler) {
        const res = await this.notFoundHandler(ctx);
        if (res instanceof Response) return res;
        return new Response("Not Found", { status: 404 });
      }

      return new Response("Not Found", { status: 404 });
    }

    // Global middlewares + route-specific handlers (kept for potential future use / debugging)
    const _allLayers: Middleware[] = [
      ...this.globalMiddlewares,
      ...(match.route.handlers as Middleware[]),
    ];

    // The last item in route.handlers is the final handler
    const finalHandler = match.route.handlers[match.route.handlers.length - 1] as Handler;

    // Remove the final handler from layers (compose expects middlewares + handler)
    const routeMiddlewares = match.route.handlers.slice(0, -1) as Middleware[];

    const composed = compose(
      [...this.globalMiddlewares, ...routeMiddlewares],
      finalHandler
    );

    try {
      const result = await composed(ctx);

      // If something returned a Response directly, use it
      if (result instanceof Response) {
        return result;
      }

      // If the context has a modified response with non-200 status, prefer it
      if (ctx.res && ctx.res.status !== 200) {
        return ctx.res;
      }

      // If the handler returned a Response via some other means (e.g. afterware modified ctx.res)
      // we already checked above.

      // Default: 204 No Content if nothing was sent
      return new Response(null, { status: 204 });
    } catch (err) {
      console.error("[@zeno/http] Unhandled error in route:", err);

      if (this.errorHandler) {
        try {
          const custom = await this.errorHandler(err, ctx);
          if (custom instanceof Response) return custom;
        } catch (handlerErr) {
          console.error("[@zeno/http] Error handler itself threw:", handlerErr);
        }
      }

      return new Response("Internal Server Error", { status: 500 });
    }
  };

  private findRoute(method: string, pathname: string): RouteMatch | null {
    const trie = this.tries.get(method);
    if (!trie) return null;

    const result = trie.find(pathname);
    if (!result) return null;

    return {
      route: result.data,
      params: result.params,
    };
  }

  /**
   * Register a custom error handler (similar to Fiber's app.onError)
   */
  onError(handler: (err: unknown, ctx: Context) => Response | Promise<Response>): this {
    this.errorHandler = handler;
    return this;
  }

  /**
   * Register custom 404 Not Found handler (Fiber style)
   */
  notFound(handler: Handler): this {
    this.notFoundHandler = handler;
    return this;
  }

  /**
   * Register custom 405 Method Not Allowed handler
   */
  methodNotAllowed(handler: (ctx: Context, allowedMethods: string) => Response | Promise<Response>): this {
    this.methodNotAllowedHandler = handler;
    return this;
  }

  /**
   * Create a route group with a prefix (Fiber-like).
   * Useful for versioning or namespacing routes.
   *
   * Example:
   *   app.group("/api/v1", (api) => {
   *     api.get("/users", handler);
   *   });
   */
  group(prefix: string, fn: (router: IRouteRegistrar) => void): this {
    const inheritedMiddlewares: Middleware[] = this instanceof RouterGroup 
      ? [...(this as RouterGroup)._middlewares] 
      : [];
    
    const subRouter = new RouterGroup(this, prefix, inheritedMiddlewares);
    fn(subRouter);
    return this;
  }

  /**
   * For testing / advanced use
   */
  getRoutes(): Route[] {
    return [...this.routes];
  }

  // === Group handler registration (called from RouterGroup) ===
  _registerGroupNotFound(prefix: string, handler: Handler): void {
    this.groupNotFoundHandlers.set(prefix, handler);
  }

  _registerGroupMethodNotAllowed(
    prefix: string, 
    handler: (ctx: Context, allowed: string) => Response | Promise<Response>
  ): void {
    this.groupMethodNotAllowedHandlers.set(prefix, handler);
  }

  // 가장 구체적인 (가장 긴 prefix) 그룹 핸들러 찾기
  private _findBestGroupHandler<T>(pathname: string, map: Map<string, T>): T | undefined {
    let bestPrefix = "";
    let bestHandler: T | undefined;

    for (const [prefix, handler] of map) {
      if (pathname.startsWith(prefix) && prefix.length > bestPrefix.length) {
        bestPrefix = prefix;
        bestHandler = handler;
      }
    }
    return bestHandler;
  }
}

/**
 * RouterGroup - Separate class for groups (does not extend Router).
 * It only shares the IRouteRegistrar interface.
 *
 * 설계 이유 (Option A 하에서):
 * - Router가 trie의 단일 진실 공급원. Group이 독립적인 라우팅 상태를 가지면 복잡도 폭발.
 * - Route 등록 시점에 middleware를 미리 결합(eager)해서 root에 위임.
 * - Nested group은 생성 시점에 middleware를 inherited로 capture.
 * - Custom notFound 등은 prefix 단위로 root에 등록 + lookup.
 * 이 방식은 runtime을 가볍게 유지하기 위함. (자세한 rationale는 SKILL.md 참조)
 */
class RouterGroup implements IRouteRegistrar {
  private groupMiddlewares: Middleware[] = [];
  private groupNotFound?: Handler;
  private groupMethodNotAllowed?: (ctx: Context, allowed: string) => Response | Promise<Response>;

  /** Internal: used by parent Router for middleware inheritance in nested groups */
  get _middlewares(): Middleware[] {
    return this.groupMiddlewares;
  }

  constructor(
    private parent: Router, 
    private prefix: string, 
    inheritedMiddlewares: Middleware[] = []
  ) {
    this.groupMiddlewares = [...inheritedMiddlewares];
  }

  use(...middlewares: Middleware[]): this {
    this.groupMiddlewares.push(...middlewares);
    return this;
  }

  notFound(handler: Handler): this {
    this.groupNotFound = handler;
    // Register with parent so it can be used during 404 resolution
    this.parent._registerGroupNotFound(this.prefix, handler);
    return this;
  }

  methodNotAllowed(handler: (ctx: Context, allowedMethods: string) => Response | Promise<Response>): this {
    this.groupMethodNotAllowed = handler;
    this.parent._registerGroupMethodNotAllowed(this.prefix, handler);
    return this;
  }

  private addPrefixedRoute(method: string, path: string, handlers: HandlerLike[]) {
    const cleanPrefix = this.prefix.replace(/\/$/, "");
    const cleanPath = path.replace(/^\//, "");
    const fullPath = cleanPrefix + "/" + cleanPath;

    const combinedHandlers = [...this.groupMiddlewares, ...handlers];

    // Delegate to parent Router via internal method
    this.parent._addRouteInternal(method, fullPath, combinedHandlers);
    return this;
  }

  get(path: string, ...handlers: HandlerLike[]): this {
    return this.addPrefixedRoute("GET", path, handlers);
  }

  post(path: string, ...handlers: HandlerLike[]): this {
    return this.addPrefixedRoute("POST", path, handlers);
  }

  put(path: string, ...handlers: HandlerLike[]): this {
    return this.addPrefixedRoute("PUT", path, handlers);
  }

  patch(path: string, ...handlers: HandlerLike[]): this {
    return this.addPrefixedRoute("PATCH", path, handlers);
  }

  delete(path: string, ...handlers: HandlerLike[]): this {
    return this.addPrefixedRoute("DELETE", path, handlers);
  }

  handle(method: string, path: string, ...handlers: HandlerLike[]): this {
    return this.addPrefixedRoute(method.toUpperCase(), path, handlers);
  }

  group(prefix: string, fn: (router: IRouteRegistrar) => void): this {
    const inherited = [...this.groupMiddlewares];
    const sub = new RouterGroup(this.parent, this.prefix.replace(/\/$/, "") + "/" + prefix.replace(/^\//, ""), inherited);
    fn(sub);
    return this;
  }
}

/**
 * Factory function (nice DX)
 */
export function createApp(): Router {
  return new Router();
}
