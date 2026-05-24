/**
 * Context Helper Tests (Enhanced Version)
 *
 * Unit-level tests that thoroughly verify the convenience methods added to Context in @zeno/http
 * (status, redirect, html, setCookie, getCookie, etc.).
 *
 * Test objectives:
 * - Verify that each helper works as intended
 * - Thoroughly cover edge cases in cookie parsing (whitespace, URL encoding, multiple cookies, etc.)
 * - Verify real-world usage patterns such as status() chaining and multiple setCookie calls
 * - Reference current implementation limitations together with integration tests (mainly cookie header reliability)
 *
 * Note: Tests in this file are strongly unit-test oriented,
 * so real HTTP request/response behavior is verified in more detail in integration tests.
 */

import { assertEquals, assertExists } from "@std/assert";
import { createContext } from "../../../http/context.ts";

Deno.test("Context - status() basic", () => {
  const req = new Request("http://localhost/test");
  const ctx = createContext(req);

  ctx.status(404);
  assertEquals(ctx.res.status, 404);
});

Deno.test("Context - status() chaining", () => {
  const req = new Request("http://localhost/test");
  const ctx = createContext(req);

  const returned = ctx.status(201);
  assertEquals(returned, ctx); // chaining 지원
  assertEquals(ctx.res.status, 201);
});

Deno.test("Context - status() multiple calls", () => {
  const req = new Request("http://localhost/test");
  const ctx = createContext(req);

  ctx.status(400).status(500);
  assertEquals(ctx.res.status, 500);
});

Deno.test("Context - html()", async () => {
  const req = new Request("http://localhost/test");
  const ctx = createContext(req);

  const res = ctx.html("<h1>Hello</h1>");
  assertEquals(res.headers.get("content-type"), "text/html; charset=utf-8");
  assertEquals(await res.text(), "<h1>Hello</h1>");
});

Deno.test("Context - redirect()", () => {
  const req = new Request("http://localhost/test");
  const ctx = createContext(req);

  const res = ctx.redirect("https://example.com", 301);
  assertEquals(res.status, 301);
  assertEquals(res.headers.get("location"), "https://example.com");
});

Deno.test("Context - redirect() default 302", () => {
  const req = new Request("http://localhost/test");
  const ctx = createContext(req);

  const res = ctx.redirect("/login");
  assertEquals(res.status, 302);
});

/* ==================== Cookie Tests (강화) ==================== */

Deno.test("Context - getCookie basic", () => {
  const req = new Request("http://localhost/", {
    headers: { cookie: "session=abc123; user=kim" },
  });
  const ctx = createContext(req);

  assertEquals(ctx.getCookie("session"), "abc123");
  assertEquals(ctx.getCookie("user"), "kim");
});

Deno.test("Context - getCookie with spaces", () => {
  const req = new Request("http://localhost/", {
    headers: { cookie: "session = abc123 ; user = kim" },
  });
  const ctx = createContext(req);

  assertEquals(ctx.getCookie("session"), "abc123");
  assertEquals(ctx.getCookie("user"), "kim");
});

Deno.test("Context - getCookie URL encoded value", () => {
  const req = new Request("http://localhost/", {
    headers: { cookie: "name=%EC%95%84%EC%9D%B4%EC%9C%A0" },
  });
  const ctx = createContext(req);

  assertEquals(ctx.getCookie("name"), "아이유");
});

Deno.test("Context - getCookie not found", () => {
  const req = new Request("http://localhost/", {
    headers: { cookie: "a=1" },
  });
  const ctx = createContext(req);

  assertEquals(ctx.getCookie("missing"), undefined);
});

Deno.test("Context - getCookie with no cookie header", () => {
  const req = new Request("http://localhost/");
  const ctx = createContext(req);

  assertEquals(ctx.getCookie("anything"), undefined);
});

Deno.test("Context - setCookie basic", () => {
  const req = new Request("http://localhost/");
  const ctx = createContext(req);

  ctx.setCookie("token", "xyz789");

  const setCookie = ctx.res.headers.get("set-cookie");
  assertExists(setCookie);
  assertEquals(setCookie.includes("token=xyz789"), true);
});

Deno.test("Context - setCookie with options", () => {
  const req = new Request("http://localhost/");
  const ctx = createContext(req);

  ctx.setCookie("session", "s1", {
    path: "/",
    httpOnly: true,
    maxAge: 3600,
  });

  const setCookie = ctx.res.headers.get("set-cookie")!;
  assertEquals(setCookie.includes("Path=/"), true);
  assertEquals(setCookie.includes("HttpOnly"), true);
  assertEquals(setCookie.includes("Max-Age=3600"), true);
});

Deno.test("Context - multiple setCookie calls append correctly", () => {
  const req = new Request("http://localhost/");
  const ctx = createContext(req);

  ctx.setCookie("a", "1");
  ctx.setCookie("b", "2", { httpOnly: true });

  const header = ctx.res.headers.get("set-cookie");
  assertExists(header);
  assertEquals(header.includes("a=1"), true);
  assertEquals(header.includes("b=2"), true);
});

Deno.test("Context - setCookie then getCookie (roundtrip in same request)", () => {
  // setCookie는 응답 헤더에만 영향을 주고, 같은 Context의 getCookie는 req를 보지 않음
  // 이 테스트는 setCookie 호출 자체가 에러 없이 동작하는지만 확인
  const req = new Request("http://localhost/");
  const ctx = createContext(req);

  ctx.setCookie("temp", "value123");
  const header = ctx.res.headers.get("set-cookie");
  assertExists(header);
  assertEquals(header.includes("temp=value123"), true);
});
