/**
 * @zeno/http
 * 
 * The first library of the Zeno project.
 * Fiber-like HTTP routing for Deno, built from scratch on Deno primitives + @std/*.
 * 
 * Official design document: ../skills/http/SKILL.md
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
