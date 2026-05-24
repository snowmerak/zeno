/**
 * HttpClient — Go http.Client style class-based HTTP client for Deno.
 *
 * See skills/http-client/SKILL.md for the authoritative API spec and design rationale.
 */

import type {
  HttpClientOptions,
  HttpResponse,
  RequestInterceptor,
  RequestOptions,
  ResponseInterceptor,
} from "./types.ts";
import { HttpError, TimeoutError } from "./errors.ts";

export class HttpClient {
  private baseURL: string;
  private defaultHeaders: Headers;
  private defaultTimeout?: number;

  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];

  constructor(options: HttpClientOptions = {}) {
    this.baseURL = options.baseURL?.replace(/\/$/, "") ?? "";
    this.defaultHeaders = new Headers(options.headers);
    this.defaultTimeout = options.timeout;
  }

  // === Interceptor registration (see SKILL.md §2.5 and §6.2 for semantics) ===
  /**
   * Register a request interceptor.
   * Interceptors run in registration order before the request is sent.
   */
  useRequestInterceptor(interceptor: RequestInterceptor): this {
    this.requestInterceptors.push(interceptor);
    return this;
  }

  /**
   * Register a response interceptor.
   * Interceptors run in registration order after the response arrives
   * but before body parsing and HttpError throwing.
   * Caution: consuming the body here prevents downstream parsing.
   */
  useResponseInterceptor(interceptor: ResponseInterceptor): this {
    this.responseInterceptors.push(interceptor);
    return this;
  }

  // === Convenience Methods ===
  get<T = unknown>(url: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>("GET", url, options);
  }

  post<T = unknown>(
    url: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>("POST", url, { ...options, body });
  }

  put<T = unknown>(
    url: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>("PUT", url, { ...options, body });
  }

  patch<T = unknown>(
    url: string,
    body?: unknown,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    return this.request<T>("PATCH", url, { ...options, body });
  }

  delete<T = unknown>(url: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    return this.request<T>("DELETE", url, options);
  }

  // === Core Request Method ===
  async request<T = unknown>(
    method: string,
    url: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const fullUrl = this.buildURL(url, options.query);

    const headers = new Headers(this.defaultHeaders);
    if (options.headers) {
      for (const [k, v] of new Headers(options.headers)) {
        headers.set(k, v);
      }
    }

    let body: BodyInit | undefined = undefined;
    if (options.body !== undefined) {
      if (typeof options.body === "string" || options.body instanceof Uint8Array) {
        body = options.body as BodyInit;
      } else {
        body = JSON.stringify(options.body) as BodyInit;
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
      }
    }

    // Build initial Request
    let req = new Request(fullUrl, {
      method,
      headers,
      body,
      signal: options.signal,
      ...options.fetchOptions,
    });

    // Apply request interceptors
    for (const interceptor of this.requestInterceptors) {
      req = await interceptor(req);
    }

    // Timeout handling
    let timeoutId: number | undefined;
    let finalSignal = req.signal;

    const timeout = options.timeout ?? this.defaultTimeout;
    if (timeout && !options.signal) {
      const controller = new AbortController();
      finalSignal = controller.signal;
      timeoutId = setTimeout(() => controller.abort(), timeout) as unknown as number;
    }

    try {
      let res = await fetch(req, { signal: finalSignal });

      // Apply response interceptors
      for (const interceptor of this.responseInterceptors) {
        res = await interceptor(res);
      }

      const response = await this.parseResponse<T>(res);

      if (!res.ok) {
        throw new HttpError(res, response.data);
      }

      return response;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new TimeoutError(timeout ?? 0);
      }
      throw err;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  private buildURL(
    path: string,
    query?: Record<string, string | number | boolean | undefined | null>,
  ): string {
    let url = this.baseURL ? this.baseURL + (path.startsWith("/") ? path : `/${path}`) : path;

    if (query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      const qs = params.toString();
      if (qs) {
        url += (url.includes("?") ? "&" : "?") + qs;
      }
    }
    return url;
  }

  private async parseResponse<T>(res: Response): Promise<HttpResponse<T>> {
    let data: T | undefined = undefined;
    const contentType = res.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        data = await res.json();
      } catch {
        data = undefined as T;
      }
    } else if (contentType.includes("text/")) {
      data = (await res.text()) as T;
    }

    return {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
      data: data as T,
      raw: res,
    };
  }

  // Escape hatch
  unwrap() {
    return { fetch };
  }
}
