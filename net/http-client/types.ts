/**
 * @zeno/http-client Types
 */

export interface HttpClientOptions {
  baseURL?: string;
  headers?: HeadersInit;
  timeout?: number;
}

export interface RequestOptions {
  query?: Record<string, string | number | boolean>;
  headers?: HeadersInit;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
  fetchOptions?: RequestInit;
}

export interface HttpResponse<T = unknown> {
  status: number;
  statusText: string;
  headers: Headers;
  data: T;
  raw: Response;
}

export type RequestInterceptor = (req: Request) => Request | Promise<Request>;
export type ResponseInterceptor = (res: Response) => Response | Promise<Response>;
