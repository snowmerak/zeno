/**
 * @zeno/http-client
 *
 * A practical HTTP client library for Deno, inspired by Go's net/http.Client.
 *
 * Design Goals:
 * - Class-based API (similar to Go's http.Client)
 * - Built on top of native fetch + @std/* only (no external dependencies)
 * - Excellent TypeScript support
 * - Easy escape hatches to raw Request/Response
 */

export { HttpClient } from "./client.ts";
export type {
  HttpClientOptions,
  HttpResponse,
  RequestInterceptor,
  RequestOptions,
  ResponseInterceptor,
} from "./types.ts";

export { HttpError, TimeoutError } from "./errors.ts";
