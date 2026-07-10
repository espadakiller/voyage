import { cp, rm, mkdir, writeFile } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await cp("iphone-app", "dist", { recursive: true });
await mkdir("dist/server", { recursive: true });
await mkdir("dist/.openai", { recursive: true });
await cp(".openai/hosting.json", "dist/.openai/hosting.json");
await writeFile("dist/server/index.js", `export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404 || request.method !== "GET") return response;
    const url = new URL(request.url);
    if (url.pathname.includes(".")) return response;
    url.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(url, request));
  }
};
`, "utf8");
