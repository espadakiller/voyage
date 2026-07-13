import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "iphone-app", "itinerary.md");
const templatePath = resolve(root, "iphone-app", "template.html");
const stylesPath = resolve(root, 'iphone-app', 'styles.css');
const appPath = resolve(root, 'iphone-app', 'app.js');

const locations = {
  1: "Verone", 2: "Verone", 3: "Ancone", 4: "Ioannina", 5: "Ioannina",
  6: "Thessalonique", 7: "Edirne", 8: "Edirne", 9: "Istanbul", 10: "Istanbul",
  11: "Safranbolu", 12: "Istanbul", 13: "Plovdiv", 14: "Sofia", 15: "Skopje",
  16: "Canyon de Matka", 17: "Prizren", 18: "Tirana", 19: "Berat", 20: "Shkoder",
  21: "Kotor", 22: "Sarajevo", 23: "Sarajevo", 24: "Mostar", 25: "Blagaj",
  26: "Split", 27: "Zagreb", 28: "Budapest", 29: "Budapest", 30: "Strasbourg"
};

const countries = {
  1: "Italie", 2: "Italie", 3: "Italie / Grece", 4: "Grece", 5: "Grece",
  6: "Grece", 7: "Turquie", 8: "Turquie", 9: "Turquie", 10: "Turquie",
  11: "Turquie", 12: "Turquie / Bulgarie", 13: "Bulgarie", 14: "Bulgarie",
  15: "Macedoine du Nord", 16: "Macedoine du Nord / Kosovo", 17: "Kosovo / Albanie",
  18: "Albanie", 19: "Albanie", 20: "Albanie / Montenegro", 21: "Montenegro",
  22: "Bosnie-Herzegovine", 23: "Bosnie-Herzegovine", 24: "Bosnie-Herzegovine",
  25: "Bosnie-Herzegovine / Croatie", 26: "Croatie", 27: "Croatie / Hongrie",
  28: "Hongrie", 29: "Hongrie / France", 30: "France"
};

const longTransferDays = new Set([1, 3, 7, 10, 12, 15, 22, 26, 27, 29]);
const recoveryDays = new Set([12, 29, 30]);
const nightTravelDays = new Set([3, 10, 12]);

function line(body, label) {
  return body.match(new RegExp("^\\*\\*" + label + " :\\*\\*\\s*(.+)$", "m"))?.[1]?.trim() || "";
}

function bullet(body, label) {
  return body.match(new RegExp("^- " + label + " :\\s*(.+)$", "m"))?.[1]?.trim() || "";
}

function parseVisits(body) {
  const block = body.match(/\*\*Visites \/ parcours :\*\*\s*\r?\n([\s\S]*?)(?=\r?\n\*\*)/)?.[1] || "";
  return block.split(/\r?\n/)
    .map(value => value.match(/^\d+\.\s+(.+)$/)?.[1]?.trim())
    .filter(Boolean);
}

function parseItinerary(markdown) {
  const sections = [...markdown.matchAll(/^### J(\d+) \u2014 (.+)\r?\n([\s\S]*?)(?=^### J\d+ \u2014|^## R\u00e9capitulatif)/gm)];
  return sections.map(section => {
    const day = Number(section[1]);
    const body = section[3];
    return {
      day,
      title: section[2].trim(),
      location: locations[day],
      country: countries[day],
      trajectory: line(body, "Trajet"),
      transport: line(body, "Transport"),
      scheme: bullet(body, "Sch\u00e9ma recommand\u00e9"),
      duration: bullet(body, "Dur\u00e9e estim\u00e9e"),
      interrail: bullet(body, "Interrail"),
      practical: bullet(body, "D\u00e9tail pratique"),
      indicativeTimes: bullet(body, "Horaires indicatifs 2026"),
      operators: bullet(body, "Op\u00e9rateurs \u00e0 v\u00e9rifier"),
      sleep: line(body, "Nuit"),
      visits: parseVisits(body),
      walk: line(body, "Randonn\u00e9e ou grande marche"),
      reservation: line(body, "R\u00e9servation"),
      planB: line(body, "Plan B"),
      note: line(body, "Note"),
      longTransfer: longTransferDays.has(day),
      nightTravel: nightTravelDays.has(day),
      walkGoal: recoveryDays.has(day) ? "Parcours libre" : longTransferDays.has(day) ? "Boucle longue si marge" : "Boucle de visite 2 h+"
    };
  });
}

const markdown = await readFile(sourcePath, "utf8");
const template = await readFile(templatePath, "utf8");
const styles = await readFile(stylesPath, 'utf8');
const app = await readFile(appPath, 'utf8');
const days = parseItinerary(markdown);

if (days.length !== 30) {
  throw new Error("Le parcours doit contenir 30 jours, " + days.length + " trouves.");
}

const payload = {
  title: "Voyage Interrail - Heritage ottoman et Balkans",
  subtitle: "29 jours + 1 jour de marge",
  safety: "Horaires, frontieres, ferries et reservations a verifier 7 jours puis 48 h avant.",
  days
};

const embedded = JSON.stringify(payload).replaceAll("</script>", "<\\/script>");
const html = template
  .replace('/*__STYLES__*/', () => styles)
  .replace('__ITINERARY_DATA__', () => embedded)
  .replace('/*__APP__*/', () => app);
const outputs = [
  resolve(root, "iphone-app", "index.html"),
  resolve(root, "dist", "index.html"),
  resolve(root, "dist", "Voyage-Balkans-iPhone.html")
];

for (const output of outputs) {
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, html, "utf8");
}

await writeFile(resolve(root, "iphone-app", "stops.json"), JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log("Application generee : " + days.length + " jours, " + days.reduce((sum, day) => sum + day.visits.length, 0) + " visites.");

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
