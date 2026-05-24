/**
 * @zeno/http
 * 
 * Zeno 프로젝트의 첫 번째 라이브러리.
 * Fiber-like HTTP routing for Deno, built from scratch on Deno primitives + @std/*.
 * 
 * 공식 설계 문서: ../skills/http/SKILL.md
 */

// Core exports
export * from "./router.ts";
export * from "./context.ts";
export * from "./trie.ts";
export * from "./types.ts";

// Middleware utilities (advanced use)
export { compose, normalizeHandlers } from "./middleware/compose.ts";

// Version
export const VERSION = "0.0.1";
