# @zeno/http

**Zeno 프로젝트의 첫 번째 공식 라이브러리**

Go의 Fiber와 유사한 개발자 경험을 **순수 Deno** 위에서 제공하는 HTTP 라우팅 라이브러리입니다.

> **중요**: 이 라이브러리는 Hono나 Oak를 기반으로 하지 않습니다.  
> Deno의 기본 API(`Deno.serve`, Web Standards) + `@std/*`만 사용하여 처음부터 직접 구현합니다.  
> (최대 개밥먹기 목적)

## 공식 문서 (Agent Skill)

이 라이브러리의 **최신 아키텍처, 설계 결정, dogfooding 기록**은 다음 파일에 있습니다:

- [skills/http/SKILL.md](../skills/http/SKILL.md)

이 파일을 **항상 최우선**으로 참고하세요. 코드와 함께 지속적으로 업데이트됩니다.

## 현재 상태

- Architecture locked (2026-05)
- Phase 0 완료: 기본 구조 세팅
- 구현 진행 중 (MVP: Router + Context + Basic middleware)

## 주요 설계 방향 (요약)

- **Context**: Hybrid 스타일 (Request/Response 기반 + 편한 Helper)
- **Middleware**: Afterware가 자연스러운 Fiber-style composition
- **Path Matching**: 처음부터 Lightweight Radix Trie 직접 구현

자세한 내용은 `skills/http/SKILL.md` 참조.

## 사용 예 (목표 모습)

```ts
import { createApp } from "@zeno/http";

const app = createApp();

app.use(async (ctx, next) => {
  const start = performance.now();
  const res = await next();
  console.log(`${ctx.req.method} ${new URL(ctx.req.url).pathname} - ${(performance.now()-start).toFixed(1)}ms`);
  return res;
});

app.group("/api/v1", (api) => {
  api.get("/users/:id", async (ctx) => {
    return ctx.json({ id: ctx.params.id, name: "Zeno" });
  });
});

Deno.serve(app.fetch);
```

## 개발

```bash
deno task dev          # 예제 실행 (추후)
deno task test
deno task bench
```

## 라이선스

MIT (예정)