import { env } from "cloudflare:workers";
export function database() {
  if (!env.DB) throw new Error("D1 is unavailable");
  return env.DB;
}
