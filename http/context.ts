/**
 * @zeno/http - Context
 * 
 * Hybrid 스타일 Context (Locked Decision)
 * - Web Standard Request/Response 기반
 * - 실사용에 필요한 helper는 Context에 직접 제공 (Fiber-like DX)
 * 
 * 자세한 설계 근거: ../skills/http/SKILL.md
 */

export interface Context {
  /** 원본 Request (Web Standard) */
  readonly req: Request;

  /** 응답 객체 (초기에는 Response, 점차 builder 형태로 발전 예정) */
  res: Response;

  /** Path parameters (예: /users/:id → { id: "123" }) */
  params: Record<string, string>;

  /** Query string helper */
  readonly query: URLSearchParams;

  /**
   * JSON 응답을 쉽게 생성
   */
  json<T = unknown>(data: T, init?: ResponseInit): Response;

  /**
   * 텍스트 응답
   */
  text(text: string, init?: ResponseInit): Response;

  // TODO: setCookie, getCookie, redirect, html 등 helper 추가 예정
}

/**
 * Context를 생성하는 내부 팩토리 (구현 예정)
 */
export function createContext(req: Request): Context {
  // Temporary placeholder implementation
  const url = new URL(req.url);
  
  return {
    req,
    res: new Response(),
    params: {},
    query: url.searchParams,

    json<T = unknown>(data: T, init?: ResponseInit): Response {
      const headers = new Headers(init?.headers);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }
      return new Response(JSON.stringify(data), {
        ...init,
        headers,
      });
    },

    text(text: string, init?: ResponseInit): Response {
      const headers = new Headers(init?.headers);
      if (!headers.has("content-type")) {
        headers.set("content-type", "text/plain; charset=utf-8");
      }
      return new Response(text, { ...init, headers });
    },
  };
}
