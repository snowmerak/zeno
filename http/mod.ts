/**
 * @zeno/http
 * 
 * Zeno 프로젝트의 첫 번째 라이브러리.
 * Fiber-like HTTP routing for Deno, built from scratch on Deno primitives + @std/*.
 * 
 * 공식 설계 문서: ../skills/http/SKILL.md
 */

// Re-exports will be added as implementation progresses
export * from "./router.ts";
export * from "./context.ts";
export * from "./trie.ts";

// Placeholder for now
export const VERSION = "0.0.1";
