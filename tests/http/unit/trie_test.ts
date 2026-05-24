/**
 * PathTrie (Radix Tree) Unit Tests
 *
 * @zeno/http의 라우팅 핵심인 PathTrie를 집중적으로 검증하는 테스트입니다.
 *
 * 주요 검증 포인트:
 * - Static path 매칭
 * - Named parameter (:id) 추출
 * - Wildcard (* 및 :name*) 지원
 * - Priority (static > param > wildcard)
 * - Shared prefix 처리 ( /api/v1 vs /api/v2 등 )
 *
 * Trie는 라우터의 가장 중요한 내부 컴포넌트 중 하나이므로,
 * 엣지 케이스까지 꼼꼼하게 테스트하고 있습니다.
 */

import { assertEquals, assertExists } from "@std/assert";
import { PathTrie } from "../../../http/trie.ts";

Deno.test("PathTrie - static paths", () => {
  const trie = new PathTrie<string>();
  trie.insert("/users", "listUsers");
  trie.insert("/users/profile", "userProfile");

  assertEquals(trie.find("/users")?.data, "listUsers");
  assertEquals(trie.find("/users/profile")?.data, "userProfile");
  assertEquals(trie.find("/users/settings"), null);
});

Deno.test("PathTrie - named parameters", () => {
  const trie = new PathTrie<string>();
  trie.insert("/users/:id", "getUser");
  trie.insert("/users/:id/posts", "userPosts");

  const m1 = trie.find("/users/123");
  assertExists(m1);
  assertEquals(m1.data, "getUser");
  assertEquals(m1.params.id, "123");
  assertEquals(m1.pattern, "/users/:id");

  const m2 = trie.find("/users/abc/posts");
  assertExists(m2);
  assertEquals(m2.data, "userPosts");
  assertEquals(m2.params.id, "abc");
});

Deno.test("PathTrie - wildcard catch-all", () => {
  const trie = new PathTrie<string>();
  trie.insert("/files/*", "catchAll");

  const m = trie.find("/files/images/2024/avatar.png");
  assertExists(m);
  assertEquals(m.data, "catchAll");
  assertEquals(m.params.wildcard, "images/2024/avatar.png");
});

Deno.test("PathTrie - named wildcard", () => {
  const trie = new PathTrie<string>();
  trie.insert("/files/:path*", "namedWildcard");

  const m = trie.find("/files/docs/report.pdf");
  assertExists(m);
  assertEquals(m.data, "namedWildcard");
  assertEquals(m.params.path, "docs/report.pdf");
});

Deno.test("PathTrie - static beats parameter", () => {
  const trie = new PathTrie<string>();
  trie.insert("/users/profile", "profilePage");
  trie.insert("/users/:id", "userById");

  const m = trie.find("/users/profile");
  assertExists(m);
  assertEquals(m.data, "profilePage"); // static should win
});

Deno.test("PathTrie - no match cases", () => {
  const trie = new PathTrie<string>();
  trie.insert("/api/v1/users", "v1");

  assertEquals(trie.find("/api/v2/users"), null);
  assertEquals(trie.find("/api/v1/users/123"), null);
  assertEquals(trie.find("/"), null);
});

Deno.test("PathTrie - root path", () => {
  const trie = new PathTrie<string>();
  trie.insert("/", "home");

  const m = trie.find("/");
  assertExists(m);
  assertEquals(m.data, "home");
});

Deno.test("PathTrie - multiple parameters", () => {
  const trie = new PathTrie<string>();
  trie.insert("/orgs/:orgId/repos/:repoId", "repo");

  const m = trie.find("/orgs/zeno/repos/trie");
  assertExists(m);
  assertEquals(m.params.orgId, "zeno");
  assertEquals(m.params.repoId, "trie");
  assertEquals(m.data, "repo");
});

Deno.test("PathTrie - wildcard with static prefix", () => {
  const trie = new PathTrie<string>();
  trie.insert("/download/:version/*", "download");

  const m = trie.find("/download/v2.3.1/images/logo.png");
  assertExists(m);
  assertEquals(m.params.version, "v2.3.1");
  assertEquals(m.params.wildcard, "images/logo.png");
});

/* ============================================================
 * Shared Prefix Stress Tests (for Radix Tree correctness)
 * ============================================================ */

Deno.test("PathTrie - shared prefix: api versions", () => {
  const trie = new PathTrie<string>();
  trie.insert("/api/v1/users", "v1Users");
  trie.insert("/api/v2/users", "v2Users");
  trie.insert("/api/v1/posts", "v1Posts");

  assertEquals(trie.find("/api/v1/users")?.data, "v1Users");
  assertEquals(trie.find("/api/v2/users")?.data, "v2Users");
  assertEquals(trie.find("/api/v1/posts")?.data, "v1Posts");
  assertEquals(trie.find("/api/v3/users"), null);
});

Deno.test("PathTrie - shared prefix with params", () => {
  const trie = new PathTrie<string>();
  trie.insert("/api/v1/users/:id", "v1User");
  trie.insert("/api/v2/users/:id", "v2User");
  trie.insert("/api/v1/users/:id/profile", "v1Profile");

  const m1 = trie.find("/api/v1/users/42");
  assertExists(m1);
  assertEquals(m1.data, "v1User");
  assertEquals(m1.params.id, "42");

  const m2 = trie.find("/api/v2/users/99/profile");
  assertEquals(m2, null); // no such route
});

Deno.test("PathTrie - deep shared prefixes", () => {
  const trie = new PathTrie<string>();
  trie.insert("/a/b/c/d", "deep1");
  trie.insert("/a/b/c/e", "deep2");
  trie.insert("/a/b/f", "shallow");

  assertEquals(trie.find("/a/b/c/d")?.data, "deep1");
  assertEquals(trie.find("/a/b/c/e")?.data, "deep2");
  assertEquals(trie.find("/a/b/f")?.data, "shallow");
  assertEquals(trie.find("/a/b/c")?.data ?? null, null);
});

Deno.test("PathTrie - priority: static > param (single segment)", () => {
  const trie = new PathTrie<string>();
  trie.insert("/items/special", "staticSpecial");
  trie.insert("/items/:id", "paramItem");

  assertEquals(trie.find("/items/special")?.data, "staticSpecial");
  assertEquals(trie.find("/items/123")?.data, "paramItem");
});

Deno.test("PathTrie - wildcard catches multi-segment paths", () => {
  const trie = new PathTrie<string>();
  trie.insert("/files/*", "allFiles");

  assertEquals(trie.find("/files/images/avatar.png")?.data, "allFiles");
  assertEquals(trie.find("/files/")?.data ?? null, "allFiles"); // edge case
});

/* ============================================================
 * Group Nesting Simulation Tests
 *
 * These tests simulate the kind of path registration patterns
 * that occur when using nested RouterGroup (e.g. /api + /v1 + /users).
 * The goal is to stress shared ancestor prefixes that arise
 * from successive prefix concatenation in Group.
 * ============================================================ */

Deno.test("PathTrie - group-style 2-level nesting (like /api/v1/users)", () => {
  const trie = new PathTrie<string>();

  // Simulates:
  // app.group("/api", ...) → inner group("/v1") → get("/users")
  trie.insert("/api/v1/users", "apiV1Users");

  const match = trie.find("/api/v1/users");
  assertExists(match);
  assertEquals(match.data, "apiV1Users");
});

Deno.test("PathTrie - multiple sibling groups under same parent (Group pattern)", () => {
  const trie = new PathTrie<string>();

  // Simulates two groups under /api
  trie.insert("/api/v1/users", "v1");
  trie.insert("/api/v2/posts", "v2");

  assertEquals(trie.find("/api/v1/users")?.data, "v1");
  assertEquals(trie.find("/api/v2/posts")?.data, "v2");
  assertEquals(trie.find("/api/v1/posts"), null);
});

Deno.test("PathTrie - deep nesting registration order stress", () => {
  const trie = new PathTrie<string>();

  // Different insertion orders that nested Groups might produce
  trie.insert("/a/b/c/d", "deep");
  trie.insert("/a/b/c", "shallow"); // ancestor registered later
  trie.insert("/a/b/e", "sibling");

  assertEquals(trie.find("/a/b/c/d")?.data, "deep");
  assertEquals(trie.find("/a/b/c")?.data, "shallow");
  assertEquals(trie.find("/a/b/e")?.data, "sibling");
});

Deno.test("PathTrie - many groups under common ancestor (simulating heavy Group usage)", () => {
  const trie = new PathTrie<string>();

  const prefixes = ["/api/v1", "/api/v2", "/api/v3", "/api/v1/admin", "/api/v2/admin"];

  prefixes.forEach((p, i) => {
    trie.insert(`${p}/resource`, `res-${i}`);
  });

  assertEquals(trie.find("/api/v1/resource")?.data, "res-0");
  assertEquals(trie.find("/api/v1/admin/resource")?.data, "res-3");
  assertEquals(trie.find("/api/v3/resource")?.data, "res-2");
});
