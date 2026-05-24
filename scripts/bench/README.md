# Benchmark Scripts

이 디렉토리는 @zeno/http의 성능 측정을 위한 스크립트를 모아두는 곳입니다.

## 목표

- raw `Deno.serve`
- `@zeno/http` (우리가 만든 것)
- Hono
- Oak

위 4가지를 동일한 워크로드로 비교 측정.

## 예정 작업

- 간단한 hello world 벤치
- path parameter 벤치
- middleware 체인 벤치

측정 결과는 `docs/` 또는 `http/` 하위에 문서화할 예정.
