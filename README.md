# Zeno

**Deno 라이브러리 컬렉션** — 여러 가지 유용한 Deno 라이브러리를 직접 만들고, 그 과정에서 Deno 생태계의 다양한 라이브러리를 **개밥먹기(dogfooding)**하는 프로젝트.

## 목표

- Deno를 깊게 이해하면서 실용적인 라이브러리들을 만드는 것
- 각 라이브러리를 만들 때 **최대한 많은 Deno/JSR 라이브러리**를 실제로 사용해보기
- AI agent(미래의 Grok 포함)가 라이브러리를 정확하게 이해하고 사용할 수 있도록 **agent skill**을 코드와 함께 작성·유지

## 현재 라이브러리

| 라이브러리     | 설명                              | 상태          |
|----------------|-----------------------------------|---------------|
| `@zeno/http`   | Fiber-like HTTP Router (std only) | 초기 구현 중  |

(예정: Redis 클라이언트, HTTP 클라이언트, TCP/UDP 유틸 등)

## 시작하기

```bash
# 예제 서버 실행 (placeholder)
deno task dev

# 테스트
deno task test
```

## 중요 규칙 (Agent Skills)

이 프로젝트의 핵심 철학 중 하나:

> **기능을 추가하거나 변경할 때마다 반드시 해당하는 agent skill을 함께 작성/수정한다.**

- `skills/http/SKILL.md` 가 `@zeno/http`의 공식 설계 문서입니다.
- 코드 변경 ↔ skill 업데이트는 항상 함께 이루어져야 합니다.

## 구조

```
zeno/
├── http/                 # @zeno/http (첫 번째 라이브러리)
├── skills/http/          # @zeno/http 전용 agent skill
├── examples/             # 라이브러리 사용 예제 (self-dogfood)
├── tests/
├── scripts/bench/        # 성능 비교 측정
└── deno.json
```

자세한 내용은 각 라이브러리 하위 README와 `skills/` 디렉토리를 참고하세요.

## 라이선스

MIT (예정)
