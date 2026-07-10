const VERIFY_NOTE = "Horaires et correspondances ? v?rifier 48h avant.";
const CHECKLIST = [
  "Pass Interrail", "Pi?ce identit? / passeport", "R?servations", "Carte bancaire", "Esp?ces",
  "Serviette microfibre", "Cadenas", "Batterie externe", "Adaptateur", "Gourde",
  "Chaussures rando", "Lessive", "M?dicaments", "Chargeur iPhone", "Copies hors-ligne billets"
];
const LOCATION_COORDS = {
  "Strasbourg": [7.7521, 48.5734], "V?rone": [10.9916, 45.4384], "Trieste": [13.7768, 45.6495],
  "Ljubljana": [14.5058, 46.0569], "Zagreb": [15.9819, 45.8150], "Travnik/Jajce": [17.48, 44.25],
  "Travnik": [17.6658, 44.2264], "Jajce": [17.2706, 44.3420], "Sarajevo": [18.4131, 43.8563],
  "Mostar": [17.8078, 43.3438], "Blagaj": [17.9026, 43.2576], "Po?itelj": [17.7313, 43.1345],
  "Kotor": [18.7712, 42.4247], "Bar": [19.1003, 42.0931], "Stari Bar": [19.1347, 42.0917],
  "Ulcinj": [19.2183, 41.9311], "Shkod?r": [19.5126, 42.0683], "Kruj?": [19.7978, 41.5095],
  "Tirana": [19.8187, 41.3275], "Prizren": [20.7397, 42.2139], "Gjakova": [20.4358, 42.3803],
  "Peja/Rugova": [20.2883, 42.6591], "Peja": [20.2883, 42.6591], "Rugova": [20.16, 42.70],
  "Pristina": [21.1655, 42.6629], "Skopje": [21.4316, 41.9981], "Tetovo": [20.9714, 42.0106],
  "Ohrid": [20.8016, 41.1231], "Sofia": [23.3219, 42.6977], "Bucarest": [26.1025, 44.4268],
  "Constan?a": [28.6348, 44.1598], "Budapest": [19.0402, 47.4979], "P?cs": [18.2323, 46.0727]
};

const state = { stops: [], selected: 0, view: "route", filter: "all", query: "" };
const app = document.getElementById("app");
const searchInput = document.getElementById("searchInput");

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[ch]));
}
function slugText(value = "") { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function stopText(stop) { return slugText(JSON.stringify(stop)); }
function selectedStop() { return state.stops[state.selected] || state.stops[0]; }
function cityForStop(stop) { return stop.sleep_city || stop.name?.split("?").pop()?.trim() || stop.name; }
function coordsForStop(stop) {
  const candidates = [cityForStop(stop), ...(stop.name || "").split("?").map(x => x.trim()), stop.transport_next?.to].filter(Boolean);
  for (const name of candidates) {
    for (const key of Object.keys(LOCATION_COORDS).sort((a,b) => b.length - a.length)) {
      if (name.includes(key)) return LOCATION_COORDS[key];
    }
  }
  return null;
}
function googleMapsSearch(label, city) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label + " " + (city || ""))}`;
}
function googleMapsRoute(stop) {
  const parts = (stop.name || "").split("?").map(x => x.trim());
  const origin = parts[0] || cityForStop(stop);
  const destination = parts[1] || stop.transport_next?.to || cityForStop(stop);
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=transit`;
}
function tagsFor(stop) {
  const tags = [];
  if (stop.departure_latest) tags.push(`<span class="pill blue">D?part max ${escapeHtml(stop.departure_latest)}</span>`);
  if (stop.sleep_city) tags.push(`<span class="pill green">Nuit ${escapeHtml(stop.sleep_city)}</span>`);
  if (stop.transport_next?.night_train || (stop.night_train_options || []).length) tags.push(`<span class="pill red">Train de nuit</span>`);
  if (stop.transport_next && stop.transport_next.mode !== "train") tags.push(`<span class="pill">${escapeHtml(stop.transport_next.mode)}</span>`);
  return tags.join("");
}
function matchesFilter(stop) {
  const text = stopText(stop);
  if (state.query && !text.includes(slugText(state.query))) return false;
  if (state.filter === "ottoman") return text.includes("ottoman") || text.includes("mosquee") || text.includes("bazar") || text.includes("hammam") || text.includes("tekke");
  if (state.filter === "hike") return (stop.hikes || []).length > 0 || text.includes("rando") || text.includes("vue");
  if (state.filter === "night") return Boolean(stop.transport_next?.night_train || (stop.night_train_options || []).length);
  if (state.filter === "bus") return stop.transport_next?.mode === "bus" || text.includes("bus non inclus");
  return true;
}
function setView(view) {
  state.view = view;
  document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === view));
  render();
}
function chooseDay(index, view = "day") {
  state.selected = Math.max(0, Math.min(index, state.stops.length - 1));
  setView(view);
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function listItems(items, city) {
  if (!items || !items.length) return `<p class="small">Rien de sp?cial ici.</p>`;
  return `<ul class="list">${items.map(item => `<li><a href="${googleMapsSearch(item, city)}" target="_blank" rel="noreferrer">${escapeHtml(item)}</a></li>`).join("")}</ul>`;
}
function budget(stop) {
  const b = stop.budget || {};
  const total = Object.values(b).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return `<div class="budget-grid">
    <div class="budget-cell"><b>${b.sleep ?? 0}?</b><span class="small">Nuit</span></div>
    <div class="budget-cell"><b>${b.food ?? 0}?</b><span class="small">Repas</span></div>
    <div class="budget-cell"><b>${b.local_transport ?? 0}?</b><span class="small">Local</span></div>
    <div class="budget-cell"><b>${total}?</b><span class="small">Total estim?</span></div>
  </div>`;
}
function dayCard(stop, index) {
  return `<button type="button" class="day-card ${index === state.selected ? "active" : ""}" data-day="${index}">
    <span class="day-badge">J${stop.day}</span>
    <span><h2>${escapeHtml(stop.name)}</h2><p class="small">${escapeHtml(stop.summary || "")}</p><span class="meta">${tagsFor(stop)}</span></span>
  </button>`;
}
function renderRoute() {
  const stops = state.stops.filter(matchesFilter);
  app.innerHTML = `${routeMap(state.selected)}<div class="route-grid">${stops.map(stop => dayCard(stop, state.stops.indexOf(stop))).join("") || `<div class="empty">Aucun r?sultat.</div>`}</div>`;
  app.querySelectorAll("[data-day]").forEach(button => button.addEventListener("click", () => chooseDay(Number(button.dataset.day))));
}
function renderDay() {
  const stop = selectedStop();
  const city = cityForStop(stop);
  const transport = stop.transport_next || {};
  const night = stop.night_train_options || [];
  app.innerHTML = `<article class="stack">
    <section class="card detail-head">
      <div class="meta"><span class="pill">J${stop.day}</span><span class="pill green">${escapeHtml(stop.country || "")}</span></div>
      <h2>${escapeHtml(stop.name)}</h2>
      <p class="small">${escapeHtml(stop.summary || "")}</p>
      <span class="meta">${tagsFor(stop)}</span>
      <div class="actions"><button class="action secondary" id="prevDay" type="button">Jour pr?c?dent</button><button class="action" id="nextDay" type="button">Jour suivant</button></div>
    </section>
    <section class="detail-grid">
      <div class="stack">
        <section class="card white"><h3 class="section-title">Programme</h3><div class="timeline">${(stop.full_day_plan || []).map(row => `<div class="time-row"><strong>${escapeHtml(row.time || "")}</strong><span><h3>${escapeHtml(row.title || "")}</h3><p class="small">${escapeHtml(row.details || "")}</p></span></div>`).join("")}</div></section>
        <section class="card white"><h3 class="section-title">? voir</h3>${listItems(stop.must_see, city)}</section>
        <section class="card white"><h3 class="section-title">Calme</h3>${listItems(stop.quiet_spots, city)}</section>
        <section class="card white"><h3 class="section-title">Rando / vues</h3>${listItems(stop.hikes, city)}</section>
      </div>
      <div class="stack">
        <section class="card"><h3 class="section-title">Carte</h3>${routeMap(state.selected, true)}<div class="actions"><a class="action" href="${googleMapsRoute(stop)}" target="_blank" rel="noreferrer">Trajet Google Maps</a><a class="action secondary" href="${googleMapsSearch(city, stop.country)}" target="_blank" rel="noreferrer">Ville</a></div></section>
        <section class="card"><h3 class="section-title">Transport suivant</h3><p class="small"><b>${escapeHtml(transport.mode || "")}</b> vers ${escapeHtml(transport.to || "")}. ${escapeHtml(transport.notes || VERIFY_NOTE)}</p><span class="meta"><span class="pill ${transport.interrail_included ? "green" : "red"}">${transport.interrail_included ? "Interrail" : "Non inclus"}</span><span class="pill ${transport.reservation_needed ? "red" : ""}">${transport.reservation_needed ? "R?servation" : "Sans r?servation"}</span></span></section>
        <section class="card"><h3 class="section-title">Trains de nuit</h3>${night.length ? `<ul class="list">${night.map(item => `<li><b>${escapeHtml(item.title)}</b><br><span class="small">${escapeHtml(item.details)}</span></li>`).join("")}</ul>` : `<p class="small">Pas de train de nuit utile indiqu? pour cette ?tape. ${VERIFY_NOTE}</p>`}</section>
        <section class="card"><h3 class="section-title">Budget</h3>${budget(stop)}</section>
        <section class="card"><h3 class="section-title">Notes pratiques</h3>${listItems([...(stop.cheap_food_tips || []), ...(stop.cheap_sleep_tips || []), ...(stop.shower_laundry_tips || []), ...(stop.safety_notes || [])], city)}</section>
      </div>
    </section>
  </article>`;
  document.getElementById("prevDay").addEventListener("click", () => chooseDay(state.selected - 1));
  document.getElementById("nextDay").addEventListener("click", () => chooseDay(state.selected + 1));
}
function renderSearch() {
  const results = state.stops.filter(matchesFilter);
  app.innerHTML = `<section class="stack"><div class="card"><h2>Recherche</h2><p class="small">${results.length} r?sultat(s)</p></div>${results.map(stop => dayCard(stop, state.stops.indexOf(stop))).join("") || `<div class="empty">Aucun r?sultat.</div>`}</section>`;
  app.querySelectorAll("[data-day]").forEach(button => button.addEventListener("click", () => chooseDay(Number(button.dataset.day))));
}
function renderMapView() {
  const stop = selectedStop();
  app.innerHTML = `<section class="stack"><div class="card"><h2>Carte du parcours</h2><p class="small">${escapeHtml(stop.name)} ? Nuit ${escapeHtml(stop.sleep_city || "")}</p></div>${routeMap(state.selected)}<div class="actions"><button class="action secondary" id="mapPrev" type="button">Pr?c?dent</button><button class="action" id="mapNext" type="button">Suivant</button></div>${dayCard(stop, state.selected)}</section>`;
  document.getElementById("mapPrev").addEventListener("click", () => chooseDay(state.selected - 1, "map"));
  document.getElementById("mapNext").addEventListener("click", () => chooseDay(state.selected + 1, "map"));
  app.querySelector("[data-day]").addEventListener("click", () => chooseDay(state.selected));
}
function renderChecklist() {
  const saved = JSON.parse(localStorage.getItem("balkans-checklist") || "{}");
  app.innerHTML = `<section class="stack"><div class="card"><h2>Sac et papiers</h2><p class="small">Sauvegard? sur cet iPhone.</p></div>${CHECKLIST.map((item, idx) => `<label class="check-row ${saved[item] ? "done" : ""}"><input type="checkbox" data-check="${idx}" ${saved[item] ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`).join("")}</section>`;
  app.querySelectorAll("[data-check]").forEach(input => input.addEventListener("change", () => {
    const item = CHECKLIST[Number(input.dataset.check)];
    saved[item] = input.checked;
    localStorage.setItem("balkans-checklist", JSON.stringify(saved));
    input.closest(".check-row").classList.toggle("done", input.checked);
  }));
}
function routeMap(activeIndex = 0, compact = false) {
  const points = state.stops.map((stop, index) => ({ stop, index, coord: coordsForStop(stop) })).filter(p => p.coord);
  const lons = points.map(p => p.coord[0]);
  const lats = points.map(p => p.coord[1]);
  const minLon = Math.min(...lons) - 1.2, maxLon = Math.max(...lons) + 1.2;
  const minLat = Math.min(...lats) - 0.9, maxLat = Math.max(...lats) + 0.9;
  const w = 760, h = compact ? 300 : 430, pad = 42;
  const xy = ([lon, lat]) => [pad + ((lon - minLon) / (maxLon - minLon)) * (w - pad * 2), h - pad - ((lat - minLat) / (maxLat - minLat)) * (h - pad * 2)];
  const path = points.map((p, i) => `${i ? "L" : "M"}${xy(p.coord).map(n => n.toFixed(1)).join(" ")}`).join(" ");
  const labels = points.filter((p, i) => i === 0 || i === points.length - 1 || p.index === activeIndex || ["Sarajevo","Kotor","Tirana","Skopje","Sofia","Budapest"].some(city => cityForStop(p.stop).includes(city)));
  return `<div class="hero-map"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Carte simplifi?e du parcours">
    <rect width="${w}" height="${h}" fill="#eef1e8"></rect>
    <path class="map-country" d="M70 170 C170 90 230 110 300 150 S430 130 510 210 S620 250 700 190"></path>
    <path class="map-country" d="M110 290 C220 250 300 300 380 255 S560 270 680 330"></path>
    <path class="route-path-muted" d="${path}"></path><path class="route-path" d="${path}"></path>
    ${points.map(p => { const [x,y] = xy(p.coord); return `<circle class="map-dot ${p.index === activeIndex ? "active" : ""}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p.index === activeIndex ? 8 : 5}"></circle>`; }).join("")}
    ${labels.map(p => { const [x,y] = xy(p.coord); return `<text class="map-label" x="${x.toFixed(1)}" y="${(y - 12).toFixed(1)}" text-anchor="middle">J${p.stop.day} ${escapeHtml(cityForStop(p.stop).replace(" / ", "/"))}</text>`; }).join("")}
  </svg></div>`;
}
function render() {
  if (!state.stops.length) { app.innerHTML = `<div class="empty">Chargement impossible.</div>`; return; }
  if (state.view === "day") renderDay();
  else if (state.view === "map") renderMapView();
  else if (state.view === "search") renderSearch();
  else if (state.view === "checklist") renderChecklist();
  else renderRoute();
}
async function init() {
  try {
    const response = await fetch("stops.json", { cache: "no-cache" });
    const payload = await response.json();
    state.stops = payload.stops || [];
  } catch (error) {
    app.innerHTML = `<div class="empty">Impossible de charger le parcours.</div>`;
    return;
  }
  searchInput.addEventListener("input", event => { state.query = event.target.value; if (state.view !== "route") state.view = "search"; document.querySelectorAll(".tab").forEach(tab => tab.classList.toggle("active", tab.dataset.view === state.view)); render(); });
  document.querySelectorAll(".chip").forEach(chip => chip.addEventListener("click", () => { state.filter = chip.dataset.filter; document.querySelectorAll(".chip").forEach(c => c.classList.toggle("active", c === chip)); render(); }));
  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => setView(tab.dataset.view)));
  document.getElementById("todayButton").addEventListener("click", () => chooseDay(state.selected, "day"));
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  render();
}
init();
