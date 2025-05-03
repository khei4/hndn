import { serve } from "https://deno.land/std@0.114.0/http/server.ts";
import { Redis } from "https://deno.land/x/upstash_redis@v1.22.0/mod.ts";

// Redis 接続設定（環境変数から取得）
const redis = new Redis({
  url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});

serve(async (req: Request) => {
  const ua = req.headers.get("user-agent") ?? "unknown";
  const now = new Date().toISOString();

  // 保存：datetime を key として user-agent を value に保存
  await redis.set(now, ua);

  // すべてのキーを取得
  const keys = await redis.keys("*");

  // すべての値を取得して文字列に整形
  const entries: string[] = [];

  for (const key of keys) {
    const value = await redis.get(key);
    entries.push(`${key}: ${value}`);
  }

  const body = [
    "=== Saved User-Agents ===",
    ...entries,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
});
