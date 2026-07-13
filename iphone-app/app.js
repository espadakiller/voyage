(function voyageApp() {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const views={route:$("#routeView"),day:$("#dayView"),progress:$("#progressView")};
  const state={view:"route",day:+localStorage.getItem("voyage-selected-day")||1,filter:"all",visitFilter:"all",query:""};
  const read=key=>{try{return JSON.parse(localStorage.getItem(key))||{}}catch(e){return{}}};
  const done=read("voyage-done-v3"), photos=read("voyage-photos-v3");
  const esc=v=>String(v||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const norm=v=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const icons=()=>window.lucide&&window.lucide.createIcons({attrs:{"aria-hidden":"true"}});
  const selected=()=>DATA.days.find(d=>d.day===state.day)||DATA.days[0];
  const key=(d,i)=>d.day+"-"+i;
  const count=d=>d.visits.reduce((n,v,i)=>n+(done[key(d,i)]?1:0),0);
  const total=()=>DATA.days.reduce((n,d)=>n+d.visits.length,0);
  const complete=()=>DATA.days.reduce((n,d)=>n+count(d),0);

  function kind(d){
    const t=norm(d.transport);
    if(d.nightTravel)return"night";
    if(t.includes("ferry"))return"ferry";
    if(t.includes("bus"))return"bus";
    if(t.includes("train"))return"train";
    return"walk";
  }
  function meta(d){
    return {night:["moon-star","Nuit","coral"],ferry:["ship","Ferry","coral"],bus:["bus-front","Bus",""],
      train:["train-front","Train",""],walk:["footprints","Sur place","green"]}[kind(d)];
  }
  const ottoman=v=>/mosquee|camii|hamam|hammam|ottoman|bazar|bezesteni|tekke|pacha|pasha|caravanserail|ali pacha|ataturk/.test(norm(v));
  const outdoor=v=>/promenade|lac|parc|jardin|mont|colline|gorge|forteresse|citadelle|rempart|panorama|belvedere|rives|front de mer|plage|coucher|pont|ile|cascade|sentier/.test(norm(v));
  function visitIcon(v){
    const x=norm(v);
    if(/mosquee|camii/.test(x))return"landmark";
    if(/hamam|hammam|bains/.test(x))return"waves";
    if(/bazar|marche|rue|centre/.test(x))return"store";
    if(/musee|maison|palais/.test(x))return"museum";
    if(/forteresse|citadelle|chateau|rempart/.test(x))return"castle";
    if(/lac|mer|plage|rives|port/.test(x))return"sailboat";
    if(/mont|colline|gorge|panorama|belvedere/.test(x))return"mountain";
    if(/eglise|cathedrale|basilique|monastere/.test(x))return"church";
    if(/pont/.test(x))return"bridge";
    return"map-pin";
  }
  const initials=v=>norm(v).split(/\s+/).filter(x=>x.length>2).slice(0,2).map(x=>x[0].toUpperCase()).join("")||"V";
  function cleanPlace(v){
    return v.replace(/^(matin|apres-midi|soir)\s*:\s*/i,"")
      .replace(/^si la marge est suffisante\s*:\s*/i,"")
      .replace(/,?\s*(si le temps le permet|selon les horaires|selon accessibilite|au minimum).*$/i,"").trim();
  }
  function routePlaces(d){
    const reject=/^(installation|retour|arrivee|depart|transfert|train|bus|ferry|traversee|bateau vers|repas|verification|aucune visite)/;
    return d.visits.map(cleanPlace).filter(v=>v&&!reject.test(norm(v)));
  }
  function routeTime(d,n){
    if(d.day===30)return"Journee libre, sans visite obligatoire";
    if(d.day===29)return"Parcours libre selon l'heure d'arrivee";
    if(d.longTransfer)return n>=5?"2 h 30 a 4 h avec les visites, si la marge transport le permet":"Environ 2 h avec les visites, seulement si la marge le permet";
    if(n>=10)return"3 h 30 a 5 h avec les visites et les pauses";
    if(n>=7)return"3 h a 4 h 30 avec les visites";
    return"2 h a 3 h 30 avec les visites";
  }
  const searchUrl=(place,d)=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(place+", "+d.location+", "+d.country);
  function routeUrls(d){
    const places=routePlaces(d), routes=[];
    for(let start=0;start<places.length;start+=8){
      const part=places.slice(start,start+9);
      if(part.length<2)break;
      const scoped=part.map(p=>p+", "+d.location+", "+d.country);
      const origin=scoped[0], last=start+9>=places.length, destination=last?origin:scoped.at(-1);
      const via=(last?scoped.slice(1):scoped.slice(1,-1)).join("|");
      let url="https://www.google.com/maps/dir/?api=1&travelmode=walking&origin="+encodeURIComponent(origin)+"&destination="+encodeURIComponent(destination);
      if(via)url+="&waypoints="+encodeURIComponent(via);
      routes.push({url,start:start+1,end:start+part.length});
    }
    return routes;
  }
  function tags(d){
    const m=meta(d), c=count(d);
    return `<span class="row-tags"><span class="tag ${m[2]}">${m[1]}</span><span class="tag green">${esc(d.walkGoal)}</span>${c?`<span class="tag">${c}/${d.visits.length}</span>`:""}</span>`;
  }
  function show(name){
    state.view=name;
    Object.entries(views).forEach(([k,v])=>v.hidden=k!==name);
    $$(".nav-button").forEach(b=>b.dataset.view===name?b.setAttribute("aria-current","page"):b.removeAttribute("aria-current"));
    if(name==="day")renderDay();
    if(name==="progress")renderProgress();
    scrollTo({top:0,behavior:"smooth"});icons();
  }

  function renderRoute(){
    const all=total(), finished=complete(), pct=all?Math.round(finished/all*100):0, q=norm(state.query);
    const filtered=DATA.days.filter(d=>{
      const found=!q||norm([d.title,d.location,d.country,d.trajectory,...d.visits].join(" ")).includes(q);
      return found&&(state.filter==="all"||state.filter===kind(d)||(state.filter==="visit"&&!d.longTransfer));
    });
    const filters=[["all","Tout"],["train","Train"],["bus","Bus"],["night","Nuit"],["visit","Grandes visites"]];
    views.route.innerHTML=`<section class="overview"><div><h1>${esc(DATA.title)}</h1><p>${esc(DATA.subtitle)}</p></div>
      <div class="metrics"><div class="metric"><strong>30</strong><span>journees</span></div><div class="metric"><strong>${all}</strong><span>lieux proposes</span></div><div class="metric"><strong>${finished}</strong><span>deja visites</span></div></div>
      <div class="progress-track" aria-label="${pct}% termine"><div class="progress-bar" style="width:${pct}%"></div></div></section>
      <section class="toolbar" aria-label="Recherche et filtres"><label class="search"><i data-lucide="search"></i><input id="daySearch" type="search" value="${esc(state.query)}" placeholder="Rechercher une ville, une visite..." autocomplete="off"></label>
      <div class="segments">${filters.map(f=>`<button class="segment" type="button" data-filter="${f[0]}" aria-pressed="${state.filter===f[0]}">${f[1]}</button>`).join("")}</div></section>
      <section class="day-grid">${filtered.length?filtered.map(d=>`<button class="day-row" type="button" data-day="${d.day}"><span class="day-number">J${d.day}</span><span class="day-copy"><strong>${esc(d.title)}</strong><small>${esc(d.duration||d.transport)}</small>${tags(d)}</span><i class="day-arrow" data-lucide="chevron-right"></i></button>`).join(""):`<div class="empty">Aucune journee ne correspond a cette recherche.</div>`}</section>`;
    $("#daySearch").oninput=e=>{state.query=e.target.value;renderRoute();const input=$("#daySearch");input.focus();input.setSelectionRange(input.value.length,input.value.length)};
    $$("[data-filter]",views.route).forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;renderRoute()});
    $$("[data-day]",views.route).forEach(b=>b.onclick=()=>pick(+b.dataset.day));
    icons();
  }

  function pick(day){
    state.day=Math.max(1,Math.min(DATA.days.length,day));state.visitFilter="all";
    localStorage.setItem("voyage-selected-day",state.day);show("day");
  }
  function visibleVisit(v,checked){
    return state.visitFilter==="all"||(state.visitFilter==="ottoman"&&ottoman(v))||(state.visitFilter==="outdoor"&&outdoor(v))||(state.visitFilter==="todo"&&!checked);
  }
  function visitCard(d,v,i){
    const checked=!!done[key(d,i)];
    if(!visibleVisit(v,checked))return"";
    const place=cleanPlace(v), category=ottoman(v)?"Patrimoine ottoman - ":outdoor(v)?"Plein air - ":"";
    return `<li class="visit-item ${checked?"done":""}"><span class="visit-order">${i+1}</span>
      <div class="visit-thumb" data-photo-query="${esc(place+" "+d.location)}" aria-hidden="true"><i data-lucide="${visitIcon(v)}"></i><span class="thumb-mark">${initials(v)}</span></div>
      <div class="visit-copy"><strong>${esc(v)}</strong><span>${category}<a class="visit-map-link" href="${searchUrl(place,d)}" target="_blank" rel="noopener">Voir sur Google Maps</a></span></div>
      <button class="check-button" type="button" data-check="${i}" aria-pressed="${checked}" aria-label="${checked?"Marquer comme non visite":"Marquer comme visite"}"><i data-lucide="check"></i></button></li>`;
  }
  function fact(icon,title,value){
    return value?`<div class="fact"><i data-lucide="${icon}"></i><div><strong>${esc(title)}</strong><span>${esc(value)}</span></div></div>`:"";
  }
  function detail(title,value){
    return value?`<details><summary>${esc(title)}<i data-lucide="chevron-down"></i></summary><p>${esc(value)}</p></details>`:"";
  }
  function renderDay(){
    const d=selected(), places=routePlaces(d), routes=routeUrls(d), m=meta(d), previous=d.day>1, next=d.day<DATA.days.length;
    const mapButtons=routes.length?routes.map((r,i)=>`<a class="button coral" href="${r.url}" target="_blank" rel="noopener"><i data-lucide="map"></i>${routes.length>1?`Parcours ${i+1} - lieux ${r.start}-${r.end}`:"Ouvrir le parcours"}</a>`).join(""):`<a class="button coral" href="${searchUrl(d.location,d)}" target="_blank" rel="noopener"><i data-lucide="map"></i>Ouvrir la zone</a>`;
    const visitFilters=[["all","Tous"],["ottoman","Ottoman"],["outdoor","Plein air"],["todo","A faire"]];
    views.day.innerHTML=`<div class="detail-nav"><button class="icon-button secondary" type="button" data-back aria-label="Retour a la liste"><i data-lucide="arrow-left"></i></button><div>
      <button class="icon-button secondary" type="button" data-previous aria-label="Jour precedent" ${previous?"":"disabled"}><i data-lucide="chevron-left"></i></button>
      <button class="icon-button secondary" type="button" data-next aria-label="Jour suivant" ${next?"":"disabled"}><i data-lucide="chevron-right"></i></button></div></div>
      <section class="hero"><div class="hero-photo" data-photo-query="${esc(d.location+" "+d.country+" city landmark")}"></div><div class="hero-scrim"></div><div class="hero-content"><p class="hero-kicker">J${d.day} - ${esc(d.country)}</p><h1>${esc(d.title)}</h1><p>${esc(d.sleep||d.location)}</p></div></section>
      <div class="detail-layout"><div class="main-column"><section class="band walk-band"><div class="walk-head"><div><h2>Parcours de visite</h2><p>${esc(routeTime(d,places.length))}</p></div><span class="walk-goal">${esc(d.walkGoal)}</span></div>
      <p class="walk-note">Google Maps ordonne les points a pied. Le temps annonce comprend aussi les visites et les pauses. Tu peux raccourcir la boucle a tout moment.</p><div class="route-actions">${mapButtons}</div></section>
      <section class="band"><div class="section-head"><div><h2>Lieux a visiter</h2><p>${count(d)} sur ${d.visits.length} marques comme visites</p></div><div class="visit-filters">${visitFilters.map(f=>`<button class="visit-filter" type="button" data-visit-filter="${f[0]}" aria-pressed="${state.visitFilter===f[0]}">${f[1]}</button>`).join("")}</div></div>
      <ol class="visit-list">${d.visits.map((v,i)=>visitCard(d,v,i)).join("")}</ol></section></div>
      <aside class="side-column"><section class="band"><h2>Trajet et nuit</h2><div class="facts">${fact(m[0],m[1],d.transport)}${fact("clock-3","Duree estimee",d.duration)}${fact("route","Trajet",d.trajectory)}${fact("bed-double","Nuit",d.sleep)}${fact("ticket-check","Interrail",d.interrail)}</div></section>
      <section class="band"><h3>Informations pratiques</h3>${detail("Organisation conseillee",d.scheme)}${detail("Detail pratique",d.practical)}${detail("Horaires indicatifs",d.indicativeTimes)}${detail("Operateurs a verifier",d.operators)}${detail("Grande marche proposee",d.walk)}${detail("Reservation",d.reservation)}${detail("Plan B",d.planB)}${detail("Note",d.note)}</section>
      <section class="band reminder"><i data-lucide="bell-ring"></i><div><strong>Avant de partir</strong><p>${esc(DATA.safety)}</p></div></section></aside></div>`;
    $("[data-back]",views.day).onclick=()=>show("route");
    if(previous)$("[data-previous]",views.day).onclick=()=>pick(d.day-1);
    if(next)$("[data-next]",views.day).onclick=()=>pick(d.day+1);
    $$("[data-visit-filter]",views.day).forEach(b=>b.onclick=()=>{state.visitFilter=b.dataset.visitFilter;renderDay()});
    $$("[data-check]",views.day).forEach(b=>b.onclick=()=>{const k=key(d,+b.dataset.check);done[k]=!done[k];if(!done[k])delete done[k];localStorage.setItem("voyage-done-v3",JSON.stringify(done));renderDay();renderRoute()});
    icons();hydrate(views.day);
  }

  function renderProgress(){
    const all=total(), finished=complete(), pct=all?Math.round(finished/all*100):0;
    views.progress.innerHTML=`<section class="overview"><div><h1>Ta progression</h1><p>Les coches restent enregistrees sur cet iPhone.</p></div>
      <div class="metrics"><div class="metric"><strong>${finished}</strong><span>visites faites</span></div><div class="metric"><strong>${all-finished}</strong><span>encore possibles</span></div><div class="metric"><strong>${pct}%</strong><span>du parcours</span></div></div>
      <div class="progress-track"><div class="progress-bar" style="width:${pct}%"></div></div></section>
      <section class="band progress-list">${DATA.days.map(d=>`<div class="progress-row"><span class="day-number">J${d.day}</span><button type="button" data-progress-day="${d.day}">${esc(d.title)}<small>${esc(d.location)}</small></button><strong>${count(d)}/${d.visits.length}</strong></div>`).join("")}</section>`;
    $$("[data-progress-day]",views.progress).forEach(b=>b.onclick=()=>pick(+b.dataset.progressDay));icons();
  }

  async function getPhoto(query){
    if(photos[query])return photos[query];
    try{
      const url="https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=1&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*&gsrsearch="+encodeURIComponent(query);
      const response=await fetch(url);if(!response.ok)return"";
      const data=await response.json(), page=Object.values(data.query&&data.query.pages||{})[0], info=page&&page.imageinfo&&page.imageinfo[0], image=info&&(info.thumburl||info.url);
      if(image){photos[query]=image;localStorage.setItem("voyage-photos-v3",JSON.stringify(photos))}return image||"";
    }catch(e){return""}
  }
  function loadPhoto(el){
    if(el.dataset.loaded)return;el.dataset.loaded="1";
    getPhoto(el.dataset.photoQuery).then(url=>{if(!url||!document.documentElement.contains(el))return;const image=new Image();image.alt="";image.loading="lazy";image.onload=()=>el.prepend(image);image.src=url});
  }
  function hydrate(scope){
    const elements=$$("[data-photo-query]",scope);
    if(!("IntersectionObserver"in window))return elements.forEach(loadPhoto);
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){observer.unobserve(entry.target);loadPhoto(entry.target)}}),{rootMargin:"180px"});
    elements.forEach(el=>observer.observe(el));
  }

  $$(".nav-button").forEach(b=>b.onclick=()=>show(b.dataset.view));
  renderRoute();show("route");addEventListener("DOMContentLoaded",icons);
  document.documentElement.dataset.appVersion="2026.07.14";
})();