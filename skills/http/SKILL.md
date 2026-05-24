# @zeno/http — Agent Skill

**Library**: `@zeno/http` (Zeno 프로젝트의 첫 번째 공식 라이브러리)
**Status**: Architecture locked + Core implementation largely complete (2026-05)
**Version of this skill**: 0.2.0 (post Group/Context refactor + stabilization phase)

---

## 1. 라이브러리 목적

`@zeno/http`는 **Go의 Fiber**와 유사한 개발자 경험(DX)을 Deno에서 제공하는 **순수 Deno-native HTTP 라우팅 라이브러리**다.

### 핵심 가치
- **Fiber-like Ergonomics**: 직관적인 라우팅, 강력한 Context, 미들웨어, 그룹핑
- **Maximum Dogfooding**: Deno의 기본 API(`Deno.serve`, Web Standards) + `@std/*` 패키지만 사용하여 처음부터 직접 구현
- **Long-term Agent Friendliness**: 이 라이브러리를 사용하는 AI agent(미래의 Grok 포함)가 정확한 API와 의도를 이해할 수 있도록 설계 단계부터 문서화

Hono, Oak 등 기존 프레임워크를 **기반으로 사용하지 않음**.  
그들은 **비교 대상**과 **나중 어댑터 레이어**로만 활용한다.

---

## 2. Locked Architectural Decisions (2026-05)

이 결정은 변경 시 이 skill과 plan.md를 함께 업데이트해야 한다.

### 2.1 Context API — Hybrid 스타일
**결정**: Web Standard Request/Response를 기반으로 하되, 실사용에 필요한 helper를 Context에 풍부하게 제공

**주요 인터페이스 방향** (예시):
```ts
interface Context {
  req: Request;                    // 원본 Request (읽기 전용)
  res: Response;                   // 응답 (초기에는 기본, 후에 builder 형태로)
  params: Record<string, string>;  // path parameter
  query: URLSearchParams;          // query string helper

  json<T = unknown>(data: T, init?: ResponseInit): Response;
  text(text: string, init?: ResponseInit): Response;
  // html, redirect, setCookie, getCookie 등 helper
}
```

**선택 이유**:
- Deno 사용자에게 Web API와 친숙
- Fiber 같은 편한 DX (ctx.json(), ctx.params) 제공
- Dogfooding 기회 최대화 (Request/Response를 직접 다루는 로직 많이 작성)

### 2.2 Middleware — Afterware Friendly
**결정**: next() 호출 **후**에도 response를 자연스럽게 수정할 수 있는 형태를 지원

**기본 시그니처 방향**:
```ts
type Next = () => Promise<Response>;
type Middleware = (ctx: Context, next: Next) => Promise<Response | void>;
```

**강조점**:
- 로깅, response time 측정, header 추가, 압축, 에러 래핑 등 "after" 작업이 편해야 함
- 단순 before-only가 아닌, Fiber 사용자들이 기대하는 후처리 편의성을 목표

### 2.4 Group 구현 방식 (Locked + Option A)
**결정**: RouterGroup은 Router를 상속하지 않고, 별도 클래스로 만들어 `IRouteRegistrar` 인터페이스만 공유. 내부적으로 `parent: Router`를 들고 route 등록은 root에 위임.

**이유**:
- Router가 trie (실제 라우팅 상태)의 single source of truth여야 함. Group마다 trie를 두는 것은 상태 분산 + 복잡도 증가.
- Route 등록 시점에 group의 middleware를 미리 결합(combinedHandlers)해서 root trie에 넣는 eager composition 방식.
- Nested group은 생성 시점에 상위 middleware를 `inherited`로 전달해서 capture.
- Custom notFound/methodNotAllowed는 prefix 단위로 root에 별도 등록 + lookup.

이 방식이 "불편해 보일" 수 있지만, runtime request path를 단순하고 빠르게 유지하기 위한 선택이다. (lazy delegation at request time은 매 요청마다 group 트리를 타는 비용 발생)

**Option A 적용 (2026-05)**: 위 설계 하에서 "1~2단계 nesting까지 실용적으로 잘 동작"하는 것을 목표로 하며, 그 이상의 극단적 사용은 limitation으로 명시.

### 2.3 Path Matching — Lightweight Radix Trie (from scratch)
**결정**: URL 라우팅을 위한 가벼운 Radix Tree / Trie 자료구조를 **처음부터 직접 구현**

**목표 지원 기능** (MVP 이후 순차):
- `:param` (필수 파라미터)
- `*wildcard` 또는 `:param*`
- 우선순위 기반 매칭
- 높은 정확도 + 좋은 성능

**선택 이유**:
- @zeno/http의 가장 큰 dogfooding + 학습 가치
- 장기적으로 성능과 기능 확장성에서 유리
- "Deno로 Trie를 직접 만든다"는 스토리 자체가 강력

---

## 3. MVP Scope (현재 단계)

**포함 (2026-05 기준, 대부분 완료)**:
- Router + Context (Builder) 핵심
- HTTP method routing + PathTrie
- Route grouping + middleware 상속 (nested 포함, 일부 edge 약함)
- Group-level custom notFound/methodNotAllowed (대부분 동작)
- Context helpers (status, json, text, html, redirect, cookies) - cookie header reliability에 residual weakness 존재
- Middleware (afterware friendly)
- onError + 404/405 처리

**명확한 약점 (현재 actively managing 중, Option A 적용)**:
- Group: 1~2단계 nesting + middleware는 실용적으로 지원. 3단계 이상 + custom notFound/methodNotAllowed 동시 사용은 advanced usage로 간주 (보장 약함).
- Context cookie: setCookie 후 Response 헤더 병합의 일부 edge case에서 신뢰도 부족.
- 위 두 영역은 "완벽"을 추구하기보다는 실용적 스코프 + 명확한 문서화로 관리.

**의도적으로 제외 (MVP 이후)**:
- Validation, WebSocket, Static files, Template 등 (별도 미들웨어/라이브러리로)

---

## 4. Dogfooding 대상 (이번 라이브러리에서 적극 사용)

### 강제/주요
- `@std/http`
- `@std/path`, `@std/fs`
- `@std/log` (logger middleware의 기반)
- `@std/testing` + `@std/assert`
- `@std/async`
- `@std/crypto` (request id 등)

### 비교/참고 (직접 의존 X)
- Hono, Oak (성능·DX 벤치마크 및 문서화용)

---

## 5. Agent가 알아야 할 중요한 원칙

1. **절대 Hono나 Oak를 import해서 사용하지 마라** (어댑터 레이어가 아닌 이상).
2. Context는 "편한 Web Standard wrapper"이지, 완전히 새로운 추상화가 아니다.
3. Path Trie 구현은 이 라이브러리의 자존심이다. 성능보다는 **정확성과 유지보수성**을 먼저.
4. 미들웨어는 "before"보다 "after"가 더 중요하게 여겨지는 설계.
5. 모든 큰 결정은 이 SKILL.md와 plan.md에 기록된다.

---

## 6. 사용 예시 (미래 모습 — 아직 구현되지 않음)

```ts
import { createApp } from "@zeno/http";

const app = createApp();

app.use(async (ctx, next) => {
  const start = Date.now();
  const res = await next();
  console.log(`${ctx.req.method} ${ctx.req.url} - ${Date.now() - start}ms`);
  return res;
});

app.group("/api", (api) => {
  api.get("/users/:id", async (ctx) => {
    const userId = ctx.params.id;
    const user = await getUser(userId);
    return ctx.json(user);
  });
});

Deno.serve(app.fetch); // 또는 app.listen(...)
```

---

## 2.5 PathTrie (Radix Tree) 구현 노트 (2026-05 업데이트)

`@zeno/http`의 라우팅 핵심인 **PathTrie**를 처음부터 직접 구현했다. 이는 이번 프로젝트에서 가장 큰 dogfooding 가치 중 하나이다.

### 구현 접근 방식
- **Correctness First**: 처음에는 공격적인 압축보다 "모든 일반적인 HTTP 라우팅 패턴이 정확히 동작"하는 것을 우선했다.
- Static 세그먼트에 대해서는 기본적인 Radix-style edge compression을 적용하되, param/wildcard와 섞일 때의 복잡도를 고려해 안정성을 우선시.
- 2026-05 중반에 공유 prefix (`/api/v1` vs `/api/v2` 등), deep nesting, priority 관련 stress test를 대량 추가하면서 insertion/find 로직을 여러 차례 강화했다.

### 현재 지원하는 패턴 (신뢰할 수 있음)
- Static paths (`/users/profile`)
- Named parameters (`/users/:id`, `/orgs/:orgId/repos/:repoId`)
- Catch-all wildcards (`/files/*`)
- Named wildcards (`/files/:path*`)
- Static + wildcard 조합 (`/download/:version/*`)
- Priority: **static > param > wildcard** (같은 레벨에서)

### Priority 규칙 (명시적)
1. Static segment가 가장 높은 우선순위
2. 그 다음 Named Parameter (`:id`)
3. 마지막으로 Wildcard (`*` 또는 `:name*`)

이 규칙은 `find()`에서 static → param → wildcard 순으로 탐색하는 방식으로 구현되었다.

### 주요 설계 결정 & 교훈 (Dogfooding 과정에서 얻은 것)
- Param과 Wildcard를 같은 노드에서 동시에 지원할 때 우선순위와 continuation 처리가 매우 까다롭다. (혼용을 피하거나, wildcard를 "마지막 수단"으로 명확히 두는 것이 좋음)
- Shared prefix가 많은 경우 (버전별 API 등) insertion 시 "가장 긴 공통 prefix"를 선택하는 로직이 필수적이다.
- 테스트를 먼저 대량 작성하고 (TDD-like) 실패하는 케이스를 보면서 구현을 개선하는 방식이 매우 효과적이었다. `@std/assert` + Deno test runner를 무겁게 사용.

### 현재 한계 (Known Limitations)
- Param과 Wildcard가 같은 레벨에 있을 때의 일부 복잡한 continuation 케이스는 아직 완벽하지 않음 (실제 라우터에서는 이런 혼용 자체를 권장하지 않는 경우가 많음).
- Character-level 극한 압축은 아직 conservative한 수준 (필요 시 나중에 최적화 가능).
- 삭제(remove) 기능은 아직 없음 (필요해지면 추가).

### 테스트 전략
- `tests/http/trie_test.ts` 에 14개 이상의 테스트 (static, param, wildcard, shared prefix stress, priority 등).
- `@std/assert`와 `@std/testing`를 적극 dogfooding 중.

이 내용은 Trie 구현이 진행될수록 계속 업데이트되어야 한다.

### Router.fetch this-binding 안전성 확보 (2026-05, basic-api 실서버 테스트 중)

**발견 배경**: "basic-api에 핸들러 대량 추가 + kill & restart & curl 테스트" 단계에서 `Deno.serve({ port }, app.fetch)` 호출 시 매 요청마다 `TypeError: Cannot read properties of undefined (reading 'findRoute')` (router.ts:134) 가 발생. Group 리팩토링 후 실사용 경로가 늘어나면서 latent bug가 표면화됨.

**원인**: `fetch`가 일반 클래스 메서드(`async fetch(req)`)였기 때문에 bare function reference 추출 시 `this`가 undefined (strict mode). fetch 내부의 모든 `this.findRoute`, `this.pathMethods`, `this.globalMiddlewares` 등이 깨짐. (테스트에서는 `app.fetch(req)` 직접 호출이라 this가 유지되어 통과.)

**해결**: `fetch`를 인스턴스 arrow field로 전환
```ts
fetch = async (req: Request): Promise<Response> => {
  // ... 기존 본문 (this. 모두 안전)
};
```
이제 `Deno.serve(app.fetch)`, `const h = app.fetch; h(req)`, any callback 전달 모두 안전.

**영향 및 교훈**:
- examples/basic-api, http/README.md, SKILL.md 예시의 `Deno.serve(app.fetch)` 가 이제 **실제로 동작**함.
- Deno/Web API handler를 외부에 노출할 때는 arrow field (또는 생성자에서 bind)가 dogfooding best practice.
- "kill → 재실행 → 실제 curl로 새 핸들러들 (DELETE/PUT/search/POST body /error) 테스트" 요청을 수행하면서 찾아낸 중요한 안정화 수정.

이런 runtime this-binding 이슈도 명시적으로 기록하여 미래 agent가 같은 함정에 빠지지 않게 한다.

---

## 7. 이 Skill을 업데이트해야 하는 경우

- Context API에 새로운 helper 추가
- Middleware compose 방식 변경
- Trie 구현 세부사항 변경
- 새로운 미들웨어 패턴 도입
- JSR 배포 관련 정책 변경

**규칙**: 코드에 중요한 변경이 있을 때마다 이 파일도 함께 수정.

---

## 8. 관련 문서

- 프로젝트 plan.md (sessions 폴더 내 최신 버전 참조)
- Zeno MEMORY.md (프로젝트 최상위 컨벤션)
- `http/` 디렉토리 내부 문서 (구현 후)

---

**이 skill은 @zeno/http의 "헌법"이다.**  
구현을 시작하기 전에 이 내용을 충분히 이해하고, 구현하면서 지속적으로 업데이트하라.