/**
 * @zeno/http - Context
 * 
 * Hybrid-style Context (Locked Decision)
 * - Based on Web Standard Request/Response
 * - Provides necessary helpers directly on Context for real usage (Fiber-like DX)
 * 
 * Detailed design rationale: ../skills/http/SKILL.md
 */

export interface Context {
  /** Original Request (Web Standard) */
  readonly req: Request;

  /**
   * Current response snapshot (read-only).
   * Prefer using status(), setCookie(), json(), etc.
   */
  readonly res: Response;

  /** Path parameters */
  params: Record<string, string>;

  /** Query string helper */
  readonly query: URLSearchParams;

  status(code: number): this;
  setCookie(name: string, value: string, options?: any): this;
  getCookie(name: string): string | undefined;

  json<T = unknown>(data: T, init?: ResponseInit): Response;
  text(text: string, init?: ResponseInit): Response;
  html(html: string, init?: ResponseInit): Response;
  redirect(url: string, status?: number): Response;
}

/**
 * Internal factory that creates Context
 * 
 * Rewritten in Builder style:
 * - status, setCookie, etc. only modify internal state
 * - json/text/html etc. generate a Response reflecting the internal state
 */
export function createContext(req: Request, initialParams: Record<string, string> = {}): Context {
  const url = new URL(req.url);

  // Internal builder state
  let _status: number | undefined;
  const _headers = new Headers();
  const _cookies: string[] = [];

  return {
    req,

    // Read-only snapshot for backward compatibility
    get res(): Response {
      const headers = new Headers(_headers);
      _cookies.forEach(c => headers.append("set-cookie", c));
      return new Response(null, {
        status: _status ?? 200,
        headers,
      });
    },

    params: { ...initialParams },
    query: url.searchParams,

    status(code: number): Context {
      _status = code;
      return this;
    },

    setCookie(name: string, value: string, options: {
      path?: string;
      httpOnly?: boolean;
      maxAge?: number;
      secure?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None';
    } = {}): Context {
      const parts = [`${name}=${encodeURIComponent(value)}`];
      if (options.path) parts.push(`Path=${options.path}`);
      if (options.httpOnly) parts.push("HttpOnly");
      if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`);
      if (options.secure) parts.push("Secure");
      if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

      _cookies.push(parts.join("; "));
      return this;
    },

    getCookie(name: string): string | undefined {
      const cookieHeader = this.req.headers.get("cookie");
      if (!cookieHeader) return undefined;

      for (const part of cookieHeader.split(";")) {
        const [rawKey, ...valParts] = part.trim().split("=");
        const key = rawKey.trim();
        if (key === name) {
          return decodeURIComponent(valParts.join("=").trim());
        }
      }
      return undefined;
    },

    json<T = unknown>(data: T, init?: ResponseInit): Response {
      const headers = new Headers(_headers);
      if (init?.headers) {
        new Headers(init.headers).forEach((v, k) => headers.set(k, v));
      }
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }

      // Append cookies
      _cookies.forEach(c => headers.append("set-cookie", c));

      const status = init?.status ?? _status ?? 200;
      return new Response(JSON.stringify(data), { status, headers });
    },

    text(text: string, init?: ResponseInit): Response {
      const headers = new Headers(_headers);
      if (init?.headers) {
        new Headers(init.headers).forEach((v, k) => headers.set(k, v));
      }
      if (!headers.has("content-type")) {
        headers.set("content-type", "text/plain; charset=utf-8");
      }

      _cookies.forEach(c => headers.append("set-cookie", c));

      const status = init?.status ?? _status ?? 200;
      return new Response(text, { status, headers });
    },

    html(html: string, init?: ResponseInit): Response {
      const headers = new Headers(_headers);
      if (init?.headers) {
        new Headers(init.headers).forEach((v, k) => headers.set(k, v));
      }
      if (!headers.has("content-type")) {
        headers.set("content-type", "text/html; charset=utf-8");
      }

      _cookies.forEach(c => headers.append("set-cookie", c));

      const status = init?.status ?? _status ?? 200;
      return new Response(html, { status, headers });
    },

    redirect(url: string, status = 302): Response {
      const headers = new Headers(_headers);
      headers.set("Location", url);
      _cookies.forEach(c => headers.append("set-cookie", c));

      return new Response(null, { status, headers });
    },
  };
}
