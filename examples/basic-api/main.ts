/**
 * @zeno/http 예제
 * 
 * 이 예제는 현재 라이브러리가 아직 완성되지 않았기 때문에
 * placeholder 동작을 보여줍니다.
 * 
 * 실제 동작은 http/ 구현이 진행되면서 업데이트될 예정입니다.
 */

import { createApp } from "../../http/mod.ts";

const app = createApp();

app.use(async (ctx, next) => {
  const start = performance.now();
  const res = await next();
  const duration = (performance.now() - start).toFixed(1);
  console.log(`${ctx.req.method} ${new URL(ctx.req.url).pathname} - ${duration}ms`);
  return res;
});

app.get("/", (ctx) => {
  return ctx.text("Hello from @zeno/http (example)!");
});

app.get("/api/hello", (ctx) => {
  return ctx.json({
    message: "Hello from Zeno",
    time: new Date().toISOString(),
  });
});

app.get("/api/users/:id", (ctx) => {
  return ctx.json({
    id: ctx.params.id,
    note: "params are not wired yet in the placeholder",
  });
});

// 현재는 placeholder 동작
Deno.serve(app.fetch, { port: 8000 });

console.log("Example server running at http://localhost:8000");
console.log("(This is still a placeholder until the real router is implemented)");
