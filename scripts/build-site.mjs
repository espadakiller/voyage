import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dataPath = resolve(root, "iphone-app", "itinerary.json");
const templatePath = resolve(root, "iphone-app", "template.html");
const stylesPath = resolve(root, "iphone-app", "styles.css");
const appPath = resolve(root, "iphone-app", "app.js");

const requiredFields = [
  "day", "date", "title", "location", "country", "trajectory", "transport",
  "departureTime", "arrivalTime", "duration", "operators", "interrailIncluded",
  "reservationRequired", "estimatedExtraCost", "sleepCity", "sleepArea", "visits",
  "ottomanVisits", "outdoorVisits", "walkingRoute", "practicalAdvice",
  "reservationAdvice", "planB", "warning"
];
const arrayFields = ["visits", "ottomanVisits", "outdoorVisits", "walkingRoute"];
const longTransferDays = new Set([1, 3, 4, 5, 6, 9, 10, 13, 16, 18, 21, 24, 26, 28, 29]);
const nightTravelDays = new Set([5, 6, 13, 18]);

function validate(payload) {
  if (!Array.isArray(payload.days) || payload.days.length !== 30) {
    throw new Error(`Le parcours doit contenir 30 jours, ${payload.days?.length || 0} trouves.`);
  }

  for (const day of payload.days) {
    for (const field of requiredFields) {
      if (!(field in day)) throw new Error(`J${day.day || "?"}: champ ${field} manquant.`);
    }
    for (const field of arrayFields) {
      if (!Array.isArray(day[field])) throw new Error(`J${day.day}: ${field} doit etre un tableau.`);
    }
    if (!Array.isArray(day.mapRoutes) || day.mapRoutes.length === 0) {
      throw new Error(`J${day.day}: aucune carte definie.`);
    }
    for (const route of day.mapRoutes) {
      if (!Array.isArray(route.points) || route.points.length < 2) {
        throw new Error(`J${day.day}: le parcours ${route.label || "sans nom"} est incomplet.`);
      }
    }
  }
}

const payload = JSON.parse(await readFile(dataPath, "utf8"));
validate(payload);

payload.days = payload.days.map(day => ({
  ...day,
  longTransfer: longTransferDays.has(day.day),
  nightTravel: nightTravelDays.has(day.day),
  walkGoal: day.walkingRoute.length === 0
    ? "Carte du trajet"
    : longTransferDays.has(day.day)
      ? "Parcours si marge"
      : "Parcours de visite 2 h+"
}));

const [template, styles, app] = await Promise.all([
  readFile(templatePath, "utf8"),
  readFile(stylesPath, "utf8"),
  readFile(appPath, "utf8")
]);
const embedded = JSON.stringify(payload).replaceAll("</script>", "<\\/script>");
const html = template
  .replace("/*__STYLES__*/", () => styles)
  .replace("__ITINERARY_DATA__", () => embedded)
  .replace("/*__APP__*/", () => app);

const outputs = [
  resolve(root, "index.html"),
  resolve(root, "iphone-app", "index.html"),
  resolve(root, "dist", "index.html"),
  resolve(root, "dist", "Voyage-Balkans-iPhone.html")
];

for (const output of outputs) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
}

await writeFile(resolve(root, "iphone-app", "stops.json"), JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`Application generee : ${payload.days.length} jours, ${payload.days.reduce((sum, day) => sum + day.visits.length, 0)} visites.`);

const serverDir = resolve(root, "dist", "server");
const hostingDir = resolve(root, "dist", ".openai");
await mkdir(serverDir, { recursive: true });
await mkdir(hostingDir, { recursive: true });
await cp(resolve(root, ".openai", "hosting.json"), resolve(hostingDir, "hosting.json"));

const worker = [
  "export default {",
  "  async fetch(request, env) {",
  "    const response = await env.ASSETS.fetch(request);",
  "    if (response.status !== 404 || request.method !== \"GET\") return response;",
  "    const url = new URL(request.url);",
  "    if (url.pathname.includes(\".\")) return response;",
  "    url.pathname = \"/index.html\";",
  "    return env.ASSETS.fetch(new Request(url, request));",
  "  }",
  "};",
  ""
].join("\n");
await writeFile(resolve(serverDir, "index.js"), worker, "utf8");
