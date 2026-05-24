/**
 * @zeno/http - Router
 * 
 * Fiber-like Router 구현의 핵심.
 * Path matching은 Lightweight Radix Trie로 직접 구현 예정.
 * 
 * 자세한 설계: ../skills/http/SKILL.md
 */

import type { Context, createContext } from "./context.ts";

export type Next = () => Promise<Response>;

export type Middleware = (ctx: Context, next: Next) => Promise<Response | void>;

export type Handler = (ctx: Context) => Response | Promise<Response>;

export interface Route {
  method: string;
  path: string;
  handler: Handler | Middleware[];
}

export class Router {
  private routes: Route[] = [];
  private middlewares: Middleware[] = [];

  /**
   * 글로벌 미들웨어 등록
   */
  use(middleware: Middleware): this {
    this.middlewares.push(middleware);
    return this;
  }

  /**
   * HTTP 메서드별 라우트 등록 (내부용)
   */
  private add(method: string, path: string, handler: Handler | Middleware | Middleware[]): this {
    const handlers = Array.isArray(handler) ? handler : [handler];
    this.routes.push({ method: method.toUpperCase(), path, handler: handlers[0] as Handler });
    // TODO: 실제로는 Middleware + Handler 분리 처리 + Trie 등록
    return this;
  }

  get(path: string, handler: Handler): this {
    return this.add("GET", path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.add("POST", path, handler);
  }

  put(path: string, handler: Handler): this {
    return this.add("PUT", path, handler);
  }

  patch(path: string, handler: Handler): this {
    return this.add("PATCH", path, handler);
  }

  delete(path: string, handler: Handler): this {
    return this.add("DELETE", path, handler);
  }

  /**
   * 라우트 그룹 (prefix)
   * TODO: 더 나은 group API 설계 필요
   */
  group(prefix: string, fn: (router: Router) => void): this {
    const sub = new Router();
    fn(sub);
    // TODO: prefix를 붙여서 routes에 병합 + Trie에 등록
    return this;
  }

  /**
   * 실제 요청 처리 (Deno.serve의 fetch handler로 사용)
   */
  async fetch(req: Request): Promise<Response> {
    // TODO: 
    // 1. Trie로 매칭
    // 2. Context 생성
    // 3. 미들웨어 + 핸들러 실행 (afterware 지원)
    const ctx = (await import("./context.ts")).createContext(req);
    
    // Very temporary placeholder
    return ctx.text(`@zeno/http router is not fully implemented yet.\nPath: ${new URL(req.url).pathname}`);
  }
}

/**
 * 편의 함수
 */
export function createApp(): Router {
  return new Router();
}
