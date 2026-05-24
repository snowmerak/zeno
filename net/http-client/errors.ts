/**
 * Custom Error classes for @zeno/http-client
 */

export class HttpError extends Error {
  status: number;
  statusText: string;
  response: Response;
  data?: unknown;

  constructor(response: Response, data?: unknown) {
    super(`HTTP Error ${response.status} ${response.statusText}`);
    this.name = "HttpError";
    this.status = response.status;
    this.statusText = response.statusText;
    this.response = response;
    this.data = data;
  }
}

export class TimeoutError extends Error {
  constructor(timeout: number) {
    super(`Request timed out after ${timeout}ms`);
    this.name = "TimeoutError";
  }
}
