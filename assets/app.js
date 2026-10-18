const PAGE = 60;
const PLATFORM = { tiktok: "TikTok", youtube: "YouTube", "youtube-shorts": "Shorts", instagram: "Instagram" };
const state = { period: "2026", platform: "all", region: "all", tipo: "all", format: "all", sort: "views", q: "", trends: false, shown: PAGE };
let videos = [];
let meta = {};

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (n) => {
  if (n == null) return "-";
  if (n >= 1e6) return (n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mi";
  if (n >= 1e3) return Math.round(n / 1e3).toLocaleString("pt-BR") + " mil";
  return n.toLocaleString("pt-BR");
};
const date = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : "");
const safeUrl = (u) => (/^https:\/\/(www\.)?(tiktok|youtube|instagram)\.com\//.test(u || "") ? u : "#");
const KEYS = ["period", "platform", "region", "tipo", "format", "sort"];

function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  for (const k of [...KEYS, "q"]) if (h.has(k)) state[k] = h.get(k);
  state.trends = h.get("trends") === "1";
}

function writeHash() {
  const h = new URLSearchParams();
  for (const k of KEYS) h.set(k, state[k]);
  if (state.q) h.set("q", state.q);
  if (state.trends) h.set("trends", "1");
  history.replaceState(null, "", "#" + h.toString());
}

function inScope(v, ignore) {
  return (state.period === "4y" || v.d >= "2026-01-01")
    && (ignore === "platform" || state.platform === "all" || v.p === state.platform)
    && (meta.so_foco || state.region === "all" || (state.region === "us" ? v.us : !v.us))
    && (state.tipo === "all" || v.k === state.tipo)
    && (state.format === "all" || v.f === state.format)
    && (state.trends || !v.tr);
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const rows = videos.filter((v) => inScope(v) && (!q || `${v.t} ${v.a}`.toLowerCase().includes(q)));
  const by = { views: (a, b) => (b.v || 0) - (a.v || 0), likes: (a, b) => (b.l || 0) - (a.l || 0), date: (a, b) => b.d.localeCompare(a.d) };
  return rows.sort(by[state.sort] || by.views);
}

function card(v, i) {
  const media = v.y
    ? `<img src="https://i.ytimg.com/vi/${esc(v.y)}/mqdefault.jpg" alt="" loading="lazy" width="320" height="180">`
    : `<span class="ph">${esc(PLATFORM[v.p])}</span>`;
  const region = meta.so_foco ? "" : `<span class="chip">${v.us ? esc(meta.foco_label || "Foco") : (v.c && v.c !== "US" ? esc(v.c) : "Mundo")}</span>`;
  // perfis que escondem curtidas devolvem um número simbólico (ex.: 3 curtidas em 50 mi de views)
  const likes = v.l && !(v.v && v.l / v.v < 0.0005) ? ` · ${num(v.l)} curtidas` : "";
  return `<article class="card">
    <div class="media ${esc(v.p)}${v.y ? "" : " ph-only"}">${media}<span class="rank">#${i + 1}</span></div>
    <div class="body">
      <div class="chips">
        <span class="chip p-${esc(v.p)}">${esc(PLATFORM[v.p])}</span>
        ${region}
        ${v.k ? `<span class="chip kind">${esc(v.k)}</span>` : ""}
        <span class="chip ${v.f === "a" ? "audio" : ""}">${v.f === "a" ? "Áudio / narração" : "Pessoa falando"}</span>
        ${v.tr ? '<span class="chip trend">trend</span>' : ""}
      </div>
      <div class="views">${num(v.v)}<small>${v.v != null ? "views" : ""}${likes}</small></div>
      <p class="title">${esc(v.t) || "(sem título)"}</p>
      <div class="meta"><span class="who">${esc(v.a)} · ${date(v.d)}</span><a href="${esc(safeUrl(v.u))}" target="_blank" rel="noopener noreferrer">Abrir ↗</a></div>
    </div>
  </article>`;
}

function renderStats() {
  const base = videos.filter((v) => inScope(v, "platform"));
  const count = (p) => base.filter((v) => v.p === p).length.toLocaleString("pt-BR");
  const top = base.reduce((m, v) => ((v.v || 0) > (m.v || 0) ? v : m), {});
  $("#stats").innerHTML = [
    [base.length.toLocaleString("pt-BR"), "vídeos no filtro"],
    [count("tiktok"), "TikTok"], [count("youtube"), "YouTube"], [count("youtube-shorts"), "Shorts"], [count("instagram"), "Instagram"],
    [num(top.v), "maior views"],
  ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
}

function render() {
  document.querySelectorAll(".seg").forEach((seg) => {
    seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === state[seg.dataset.key])));
  });
  $("#sort").value = state.sort;
  $("#q").value = state.q;
  $("#trends").checked = state.trends;
  const rows = filtered();
  const shown = rows.slice(0, state.shown);
  $("#grid").innerHTML = shown.length ? shown.map(card).join("") : '<p class="empty">Nenhum vídeo com esses filtros.</p>';
  $("#summary").textContent = `Mostrando ${shown.length.toLocaleString("pt-BR")} de ${rows.length.toLocaleString("pt-BR")} vídeos`;
  $("#more").hidden = rows.length <= state.shown;
  renderStats();
  writeHash();
}

function setupTipo() {
  const cats = meta.categorias || [];
  if (!cats.length) return;
  $("#seg-tipo").innerHTML = ["all", ...cats].map((c) => `<button data-value="${esc(c)}">${c === "all" ? "Todos" : esc(c)}</button>`).join("");
  $("#g-tipo").hidden = false;
}

function bind() {
  document.querySelectorAll(".seg").forEach((seg) => {
    seg.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      state[seg.dataset.key] = b.dataset.value;
      state.shown = PAGE;
      render();
    });
  });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; state.shown = PAGE; render(); });
  $("#trends").addEventListener("change", (e) => { state.trends = e.target.checked; state.shown = PAGE; render(); });
  let t;
  $("#q").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; state.shown = PAGE; render(); }, 150); });
  $("#more").addEventListener("click", () => { state.shown += PAGE; render(); });
}

fetch("data/videos.json")
  .then((r) => r.json())
  .then((data) => { videos = data.videos; meta = data.meta || {}; setupTipo(); readHash(); bind(); render(); })
  .catch(() => { $("#grid").innerHTML = '<p class="empty">Não foi possível carregar os dados.</p>'; });
