// main.ts
import { serve } from "https://deno.land/std@0.114.0/http/server.ts";

serve((req: Request) => {
console.log(req);
  return new Response("Hello from Deno!");
});