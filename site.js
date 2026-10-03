// ===== Store settings: edit here =====
const CONFIG = {
  currency: "€",
  saleEnds: "2026-10-31T23:59:59",   // launch prices end here; null = no countdown
  // full = normal price, promo = launch price (used until saleEnds). 0 = free.
  prices: {
    lucha:     { full: 0,  promo: null },
    moveaside: { full: 29, promo: 19 },
    chordflow: { full: 29, promo: 19 },
    twig:      { full: 59, promo: 39 },
    robovoco:  { full: 29, promo: 19 },
    bundle:    { full: 99, promo: 69 },
  },
  // Lemon Squeezy checkout links (Products > Share > checkout URL). null = "Checkout isn't connected yet".
  checkout: { moveaside: null, chordflow: null, twig: null, robovoco: null, bundle: null },
  demos:    { moveaside: null, chordflow: null, twig: null, robovoco: null },   // demo download links
  // Kit (kit.com) form IDs: the number in the form's URL. Each form can send its own email.
  kit: { luchaFormId: null, discountFormId: null },
  // The scratch card's code. Create the same code in Lemon Squeezy (Store > Discounts).
  discount: { code: "SCRATCH10", percent: 10 },
  // Audio demos per plugin: [{ title: "Drum bus through Suplex", note: "Dry, then wet", file: "audio/lucha-1.mp3" }]
  audio: { lucha: [], moveaside: [], chordflow: [], twig: [], robovoco: [] },
};

const PLUGINS = [
  { key: "lucha",     page: "lucha-effects.html",     name: "Lucha Effects",     kind: "Multi-effect",      line: "Every preset is a luchador. 36 moves." },
  { key: "moveaside", page: "move-a-side-chain.html", name: "Move-a-Side chain", kind: "Ducker · Width",    line: "The duck moves the stereo width." },
  { key: "chordflow", page: "chordflow.html",         name: "ChordFlow",         kind: "Chord generator",   line: "Pick a genre, drag the chords out." },
  { key: "twig",      page: "twig.html",              name: "Twig",              kind: "Resynthesis synth", line: "Grow a synth out of any sample." },
  { key: "robovoco",  page: "robovoco.html",          name: "RoboVoco",          kind: "Vocal effect",      line: "Robot, vocoder, talk box, acid." },
];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---- prices ----
const saleOn = () => !CONFIG.saleEnds || Date.now() < new Date(CONFIG.saleEnds).getTime();
const promo = key => (saleOn() ? CONFIG.prices[key].promo : null);
const nowPrice = key => promo(key) ?? CONFIG.prices[key].full;
const money = n => n === 0 ? "Free" : CONFIG.currency + (Number.isInteger(n) ? n : n.toFixed(2));
const salePct = key => promo(key) == null || !CONFIG.prices[key].full ? 0 : Math.round((1 - promo(key) / CONFIG.prices[key].full) * 100);
const wasHtml = key => promo(key) != null ? `<s>${money(CONFIG.prices[key].full)}</s>` : "";

function paintPrices() {
  document.querySelectorAll("[data-price]").forEach(el => { el.textContent = money(nowPrice(el.dataset.price)); });
  document.querySelectorAll("[data-was]").forEach(el => {
    const key = el.dataset.was;
    el.textContent = promo(key) != null ? money(CONFIG.prices[key].full) : "";
  });
  const tag = document.getElementById("save-tag");
  if (!tag) return;
  const save = CONFIG.prices.bundle.full - nowPrice("bundle");
  tag.textContent = save > 0 ? `save ${money(save)}` : "";
  tag.hidden = !save;
}

// ---- ticker ----
function paintTicker() {
  const track = document.getElementById("ticker");
  if (!track) return;
  const top = Math.max(...Object.keys(CONFIG.prices).map(salePct));
  const items = [
    top ? `Launch sale · up to ${top}% off` : "Five plugins, one bundle",
    "Lucha Effects is free",
    `All five plugins · ${money(nowPrice("bundle"))}`,
    "VST3 · AU · Standalone",
    "One licence, yours forever",
  ];
  [...items, ...items, ...items, ...items].forEach((t, i) => {
    const s = document.createElement("span");
    s.textContent = t;
    if (i >= items.length) s.setAttribute("aria-hidden", "true");
    track.append(s);
  });
}

// ---- toast ----
let toastTimer;
function toast(text) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

// ---- links: Buy goes to our checkout page, demos to their downloads ----
function wireLinks() {
  document.querySelectorAll("[data-buy]").forEach(a => { a.href = `checkout.html?p=${a.dataset.buy}`; });
  document.querySelectorAll("[data-demo]").forEach(a => {
    const url = CONFIG.demos[a.dataset.demo];
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; }
    else a.addEventListener("click", e => { e.preventDefault(); toast("Demo download coming soon."); });
  });
}

// ---- Kit signup, shared by the free Lucha form and the scratch card ----
async function subscribe(formId, email) {
  if (!formId) throw new Error("Kit form ID is not set in CONFIG.kit");
  const body = new FormData();
  body.append("email_address", email);
  const res = await fetch(`https://app.kit.com/forms/${formId}/subscriptions`, {
    method: "POST", body, headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Kit answered ${res.status}`);
}

// ---- hero reel: an HTML "video" that plays through every plugin ----
function buildReel() {
  const reel = document.getElementById("reel");
  if (!reel) return;
  // Fetch and decode every screenshot up front, so no scene ever comes on before its picture.
  PLUGINS.forEach(p => {
    const img = new Image();
    img.src = `img/${p.key}.webp`;
    img.decode().catch(err => console.error(`Hero reel: img/${p.key}.webp did not load`, err));
  });
  const scenes = [
    { el: sceneIntro(), ms: 2600 },
    ...PLUGINS.map(p => ({ el: scenePlugin(p), ms: 3400 })),
    { el: sceneOutro(), ms: 4200 },
  ];
  const bar = document.createElement("div");
  bar.className = "reel-progress";
  scenes.forEach(s => { reel.append(s.el); bar.append(document.createElement("i")); });
  reel.append(bar);
  const ticks = [...bar.children];

  let i = -1, timer = null, visible = true;
  const show = n => {
    i = n % scenes.length;
    scenes.forEach((s, j) => s.el.classList.toggle("is-on", j === i));
    ticks.forEach((t, j) => {
      t.classList.toggle("done", j < i);
      t.classList.remove("now");
      if (j === i) { void t.offsetWidth; t.classList.add("now"); }   // restart the fill
    });
    reel.style.setProperty("--d", scenes[i].ms + "ms");
  };
  const next = () => { show(i + 1); schedule(); };
  const schedule = () => { clearTimeout(timer); if (visible && !document.hidden) timer = setTimeout(next, scenes[i].ms); };

  if (reducedMotion) { show(scenes.length - 1); return; }   // a still frame: the whole bundle
  show(0);
  schedule();
  document.addEventListener("visibilitychange", schedule);
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    reel.classList.toggle("paused", !visible);
    schedule();
  }).observe(reel);
}

function scene(cls, href, key) {
  const a = document.createElement("a");
  a.className = "scene " + cls;
  a.href = href;
  a.tabIndex = -1;   // the reel is decoration; the same links are in the nav and lineup
  if (key) a.dataset.p = key;
  return a;
}

function sceneIntro() {
  const s = scene("scene-intro", "#plugins");
  s.innerHTML = `<div class="bars">${PLUGINS.map(p => `<i style="background:var(--c)" data-p="${p.key}"></i>`).join("")}</div>
    <strong>calobra<i>.</i></strong><span>five plugins · one bundle</span>`;
  return s;
}

function scenePlugin(p) {
  const s = scene("scene-plugin", p.page, p.key);
  const price = nowPrice(p.key) === 0 ? "<b>Free</b>" : `${wasHtml(p.key)}<b>${money(nowPrice(p.key))}</b>`;
  s.innerHTML = `<span class="reel-price">${price}</span>
    <div class="reel-shot"><img src="img/${p.key}.webp" alt="" loading="eager"></div>
    <div class="reel-copy"><span class="label">${p.kind}</span><b>${p.name}</b></div>`;
  return s;
}

function sceneOutro() {
  const s = scene("scene-outro", "#bundle");
  s.innerHTML = `<div class="fan">${["chordflow", "twig", "robovoco", "moveaside", "lucha"].map(k => `<img src="img/${k}.webp" alt="" loading="lazy">`).join("")}</div>
    <div class="reel-copy"><b>all five · ${money(nowPrice("bundle"))}</b><span class="btn">Get the bundle →</span></div>`;
  return s;
}

// ---- top nav: the Plugins dropdown ----
function buildMega() {
  document.querySelectorAll(".mega").forEach(box => {
    const cards = PLUGINS.map(p => `
      <a class="mega-card" href="${p.page}" data-p="${p.key}">
        <div class="thumb"><img src="img/${p.key}.webp" alt="" loading="lazy"></div>
        <b>${p.name}</b><span>${p.kind}</span>
        <em>${nowPrice(p.key) === 0 ? "Free" : wasHtml(p.key) + money(nowPrice(p.key))}</em>
      </a>`).join("");
    box.innerHTML = `<div class="mega-inner">${cards}
      <a class="mega-bundle" href="index.html#bundle">
        <div><b>the bundle</b><span>All five plugins, one licence.</span></div>
        <strong>${money(nowPrice("bundle"))}${promo("bundle") != null ? `<s>${money(CONFIG.prices.bundle.full)}</s>` : ""}</strong>
      </a></div>`;
  });
}

// ---- mobile menu: a button in the header opens every plugin and page ----
function buildMobileMenu() {
  const bar = document.querySelector(".top .wrap");
  if (!bar) return;
  const onHome = /(^|\/)(index\.html)?$/.test(location.pathname);
  const home = onHome ? "" : "index.html";

  const btn = document.createElement("button");
  btn.className = "menu-btn";
  btn.type = "button";
  btn.setAttribute("aria-expanded", "false");
  btn.setAttribute("aria-controls", "mobile-menu");
  btn.setAttribute("aria-label", "Menu");
  btn.innerHTML = "<i></i><i></i><i></i>";
  // keep the header's right-hand items together: [cta][menu]
  const end = document.createElement("div");
  end.className = "top-end";
  end.append(...[bar.lastElementChild].filter(el => el && !el.matches("nav, .logo")), btn);
  bar.append(end);

  const menu = document.createElement("nav");
  menu.className = "mobile-menu";
  menu.id = "mobile-menu";
  menu.setAttribute("aria-label", "Mobile");
  let i = 1;   // stagger order for the slide-in
  const item = () => `class="mm-item" style="--i:${i++}"`;
  menu.innerHTML = `
    <span class="label mm-item" style="--i:0">Plugins</span>
    <div class="mm-plugins">${PLUGINS.map(p => `
      <a class="mm-plugin mm-item" style="--i:${i++}" href="${p.page}" data-p="${p.key}">
        <span class="thumb"><img src="img/${p.key}.webp" alt="" loading="lazy"></span>
        <span><b>${p.name}</b><small>${p.kind}</small></span>
        <em>${nowPrice(p.key) === 0 ? "Free" : wasHtml(p.key) + money(nowPrice(p.key))}</em>
      </a>`).join("")}
    </div>
    <ul class="mm-links">
      <li ${item()}><a href="${home}#bundle">The bundle</a></li>
      <li ${item()}><a href="${home}#free">Free plugin</a></li>
      <li ${item()}><a href="${home}#faq">FAQ</a></li>
    </ul>
    <a class="btn mm-item" style="--i:${i++}" href="checkout.html?p=bundle">Get all five · ${money(nowPrice("bundle"))}</a>`;
  document.body.append(menu);

  const setOpen = open => {
    btn.setAttribute("aria-expanded", String(open));
    btn.setAttribute("aria-label", open ? "Close menu" : "Menu");
    menu.style.setProperty("--menu-top", document.getElementById("top").getBoundingClientRect().bottom + "px");
    menu.classList.toggle("open", open);
    document.documentElement.classList.toggle("menu-open", open);
    if (open) setTimeout(() => menu.querySelector("a")?.focus({ preventScroll: true }), 60);   // once it is visible
  };
  const close = () => { if (menu.classList.contains("open")) { setOpen(false); btn.focus(); } };

  btn.addEventListener("click", () => setOpen(!menu.classList.contains("open")));
  menu.addEventListener("click", e => { if (e.target.closest("a")) setOpen(false); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });
  matchMedia("(min-width: 981px)").addEventListener("change", e => { if (e.matches) setOpen(false); });
}

// ---- lineup tiles ----
function buildTiles() {
  const box = document.getElementById("tiles");
  if (!box) return;
  PLUGINS.forEach(p => {
    const a = document.createElement("a");
    a.className = "tile reveal";
    a.href = p.page;
    a.dataset.p = p.key;
    a.innerHTML = `
      <span class="price">${wasHtml(p.key)}${money(nowPrice(p.key))}</span>
      <span class="label">${p.kind}</span>
      <h3>${p.name}</h3>
      <p>${p.line}</p>
      <img src="img/${p.key}.webp" alt="" loading="lazy" decoding="async">`;
    box.append(a);
  });
}

// ---- countdown ----
function startClock() {
  if (!CONFIG.saleEnds || !saleOn() || !document.getElementById("clock")) return;
  const end = new Date(CONFIG.saleEnds).getTime();
  const cells = Object.fromEntries([...document.querySelectorAll("[data-t]")].map(el => [el.dataset.t, el]));
  document.getElementById("clock-wrap").hidden = false;
  const tick = () => {
    const left = Math.max(0, end - Date.now());
    if (!left) { location.reload(); return; }   // sale over: repaint with full prices
    const s = Math.floor(left / 1000);
    cells.d.textContent = Math.floor(s / 86400);
    cells.h.textContent = String(Math.floor(s / 3600) % 24).padStart(2, "0");
    cells.m.textContent = String(Math.floor(s / 60) % 60).padStart(2, "0");
    cells.s.textContent = String(s % 60).padStart(2, "0");
  };
  tick();
  setInterval(tick, 1000);
}

// ---- free Lucha form ----
function wireFreeForm() {
  const form = document.getElementById("free-form");
  if (!form) return;
  const input = document.getElementById("free-email");
  const msg = document.getElementById("free-msg");
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!input.checkValidity()) { msg.textContent = "Enter a valid email address, like name@example.com."; input.focus(); return; }
    if (!CONFIG.kit.luchaFormId) { msg.textContent = "Free downloads open soon. Check back in a few days."; return; }
    msg.textContent = "Sending…";
    try {
      await subscribe(CONFIG.kit.luchaFormId, input.value.trim());
      msg.textContent = "Sent. Check your inbox for Lucha Effects.";
      form.reset();
    } catch (err) {
      console.error("Free Lucha signup failed:", err);
      msg.textContent = "That didn't go through. Try again in a minute.";
    }
  });
}

// ---- FAQ: answers open and close with a height animation ----
function wireFaq() {
  if (reducedMotion) return;   // the browser's instant toggle
  const timing = { easing: "cubic-bezier(.22, .8, .24, 1)", fill: "forwards" };
  document.querySelectorAll(".faq details").forEach(d => {
    const summary = d.querySelector("summary");
    const answer = d.querySelector("p");
    let anim = null;
    summary.addEventListener("click", e => {
      e.preventDefault();
      const opening = !d.open || d.dataset.state === "closing";
      const from = d.getBoundingClientRect().height;
      anim?.cancel();
      answer.getAnimations().forEach(a => a.cancel());
      d.style.overflow = "hidden";
      d.open = true;
      const css = getComputedStyle(d);
      const borders = parseFloat(css.borderTopWidth) + parseFloat(css.borderBottomWidth);
      const to = opening ? d.scrollHeight + borders : summary.offsetHeight + borders;
      d.dataset.state = opening ? "opening" : "closing";
      const mine = d.animate({ height: [from + "px", to + "px"] }, { ...timing, duration: opening ? 450 : 350 });
      answer.animate(opening
        ? [{ opacity: 0, transform: "translateY(-8px)" }, { opacity: 1, transform: "none" }]
        : [{ opacity: 1 }, { opacity: 0 }], { ...timing, duration: opening ? 400 : 220 });
      anim = mine;
      mine.onfinish = () => {
        if (anim !== mine) return;
        if (!opening) d.open = false;
        d.style.overflow = "";
        delete d.dataset.state;
        mine.cancel();   // drop the held height; the element is back to its natural size
        answer.getAnimations().forEach(a => a.cancel());
        anim = null;
      };
    });
  });
}

// ---- audio demos on plugin pages ----
const PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h4.5v16H6zM13.5 4H18v16h-4.5z"/></svg>';
const BARS = 56;

/** A made-up but stable waveform for each demo, so every row looks different. */
function waveHeights(seed) {
  let x = [...seed].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    x = (x * 1664525 + 1013904223) >>> 0;
    const envelope = Math.sin(Math.PI * (i + 1) / (BARS + 1)) * .6 + .4;
    return Math.round((20 + (x % 80)) * envelope);
  });
}

const clockText = s => isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";

function buildDemos() {
  const boxes = document.querySelectorAll("[data-demos]");
  if (!boxes.length) return;
  const audio = new Audio();
  const rows = [];
  let current = null;   // the row that owns the audio

  const paint = row => {
    if (!row) return;
    const playing = row === current && !audio.paused;
    row.btn.innerHTML = playing ? PAUSE : PLAY;
    row.btn.setAttribute("aria-label", `${playing ? "Pause" : "Play"} ${row.title}`);
    const p = row === current && audio.duration ? audio.currentTime / audio.duration : 0;
    row.bars.forEach((b, i) => b.classList.toggle("on", i < p * BARS));
    row.time.textContent = row === current ? clockText(audio.currentTime) : row.length;
  };
  audio.addEventListener("timeupdate", () => paint(current));
  audio.addEventListener("play", () => rows.forEach(paint));
  audio.addEventListener("pause", () => rows.forEach(paint));
  audio.addEventListener("ended", () => { audio.currentTime = 0; rows.forEach(paint); });
  audio.addEventListener("error", () => toast("That demo couldn't be played."));

  boxes.forEach(box => {
    const list = CONFIG.audio[box.dataset.demos] || [];
    const items = list.length ? list : [1, 2, 3].map(n => ({ title: `Demo ${n}`, note: "Coming soon" }));
    items.forEach(item => {
      const el = document.createElement("div");
      el.className = "demo" + (item.file ? "" : " soon");
      el.innerHTML = `<button type="button" ${item.file ? "" : "disabled"} aria-label="Play ${item.title}">${PLAY}</button>
        <div><div class="demo-title">${item.title}<small>${item.note || ""}</small></div>
        <div class="wave" aria-hidden="true">${waveHeights(item.title + box.dataset.demos).map(h => `<i style="height:${h}%"></i>`).join("")}</div></div>
        <span class="demo-time">${item.file ? "0:00" : "soon"}</span>`;
      box.append(el);
      if (!item.file) return;
      const row = { title: item.title, btn: el.querySelector("button"), bars: [...el.querySelectorAll(".wave i")], time: el.querySelector(".demo-time"), length: "0:00" };
      rows.push(row);
      const probe = new Audio();   // read the length for the time label
      probe.preload = "metadata";
      probe.src = item.file;
      probe.addEventListener("loadedmetadata", () => { row.length = clockText(probe.duration); paint(row); });
      row.btn.addEventListener("click", () => {
        if (current !== row) { const prev = current; audio.src = item.file; current = row; paint(prev); }
        if (audio.paused) audio.play().catch(err => console.error("Demo playback failed:", err));
        else audio.pause();
      });
      el.querySelector(".wave").addEventListener("click", e => {   // click the waveform to seek
        if (current !== row || !audio.duration) return;
        const r = e.currentTarget.getBoundingClientRect();
        audio.currentTime = (e.clientX - r.left) / r.width * audio.duration;
      });
    });
  });
}

// ---- scroll: header state, reveals ----
function wireScroll() {
  const top = document.getElementById("top");
  const onScroll = () => top.classList.toggle("scrolled", scrollY > 8);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  const reveals = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) { reveals.forEach(el => el.classList.add("in")); return; }
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
  }), { rootMargin: "0px 0px -8% 0px" });
  reveals.forEach(el => io.observe(el));
}

paintPrices();
paintTicker();
buildMega();
buildMobileMenu();
buildReel();
buildTiles();
buildDemos();
wireLinks();
startClock();
wireFreeForm();
wireFaq();
wireScroll();
