import "https://deno.land/std@0.203.0/dotenv/load.ts";
import { Redis } from "https://deno.land/x/upstash_redis@v1.22.0/mod.ts";

const redis = new Redis({
  url: Deno.env.get("UPSTASH_REDIS_REST_URL")!,
  token: Deno.env.get("UPSTASH_REDIS_REST_TOKEN")!,
});

const HN_API = "https://hacker-news.firebaseio.com/v0";

async function fetchArticleContent(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    const html = await res.text();
    const match = html.match(/<meta name="description" content="(.*?)"/i);
    if (match) return match[1];
    const bodyMatch = html.match(/<p>(.*?)<\/p>/i);
    return bodyMatch ? bodyMatch[1] : "(content not found)";
  } catch {
    return "(failed to fetch content)";
  }
}

async function fetchTopHNStories(limit = 4) {
  const ids: number[] = await (await fetch(`${HN_API}/topstories.json`)).json();
  const topIds = ids.slice(0, limit);

  const stories = await Promise.all(
    topIds.map(async (id) => {
      const story = await (await fetch(`${HN_API}/item/${id}.json`)).json();
      const comments = await Promise.all(
        (story.kids?.slice(0, 3) || []).map(async (cid: number) => {
          const comment = await (await fetch(`${HN_API}/item/${cid}.json`)).json();
          return comment.text?.replace(/<[^>]*>/g, "") || "(no comment)";
        })
      );
      const url = story.url || `https://news.ycombinator.com/item?id=${id}`;
      const content = await fetchArticleContent(url);
      return {
        title: story.title,
        url,
        content,
        comments,
      };
    })
  );

  return stories;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);

  if (url.pathname === "/hn") {
    const n = parseInt(url.searchParams.get("n") ?? "4");
    const stories = await fetchTopHNStories(n);
    const formatted = stories.map((s, i) => {
      const comments = s.comments.map(c => `    - ${c}`).join("\n");
      return `${i + 1}. ${s.title}\n   ${s.url}\n   ${s.content}\n${comments}`;
    }).join("\n\n");

    return new Response(`=== Hacker News Top Stories ===\n\n${formatted}`, {
      headers: { "Content-Type": "text/plain" },
    });
  }

  const ua = req.headers.get("user-agent") ?? "unknown";
  const now = new Date().toISOString();
  await redis.set(now, ua);

  const keys = await redis.keys("*");
  const entries = await Promise.all(keys.map(async (key) => {
    const val = await redis.get(key);
    return `${key}: ${val}`;
  }));

  const body = [
    "=== Saved User-Agents === could you see change?",
    ...entries,
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain",
    },
  });
});
