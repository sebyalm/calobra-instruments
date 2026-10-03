// Scratch card pop-up: scratch to reveal 10% off, then give an email (sent to Kit) to get the code.
// Shown once a little after the page opens; not again for a week after it is closed, never after a claim.
(() => {
  const KEY = "calobra-scratch";          // localStorage: { state: "closed" | "claimed", at, email }
  const SHOW_AFTER_MS = 2500;
  const SNOOZE_DAYS = 7;
  const CLEAR_TO_REVEAL = 0.45;           // share of the card scratched off before it counts as revealed

  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
  const write = v => { try { localStorage.setItem(KEY, JSON.stringify({ ...v, at: Date.now() })); } catch { /* private mode: it just shows again */ } };

  const saved = read();
  const snoozed = saved.state === "closed" && Date.now() - saved.at < SNOOZE_DAYS * 864e5;
  if (saved.state === "claimed" || snoozed || document.body.dataset.page === "checkout") return;

  const { code, percent } = CONFIG.discount;
  const dialog = document.createElement("dialog");
  dialog.className = "scratch";
  dialog.setAttribute("aria-labelledby", "scratch-title");
  dialog.innerHTML = `
    <div class="scratch-body">
      <button class="scratch-close" type="button" aria-label="Close">×</button>
      <span class="label">Lucky you</span>
      <h2 id="scratch-title">scratch for a discount.</h2>
      <p>Scratch the card, then drop your email and the code is yours.</p>
      <div class="card-area">
        <div class="card-prize"><b>${percent}% off</b><span>everything at Calobra</span></div>
        <canvas aria-hidden="true"></canvas>
      </div>
      <button class="reveal-link" type="button">Can't scratch? Reveal it</button>
      <form novalidate>
        <label class="sr" for="scratch-email">Email address</label>
        <input id="scratch-email" type="email" placeholder="you@example.com" autocomplete="email" required>
        <button class="btn" type="submit" disabled>Scratch the card first</button>
      </form>
      <p class="msg" aria-live="polite"></p>
      <p class="fine">No spam. Unsubscribe any time.</p>
    </div>`;
  document.body.append(dialog);

  const area = dialog.querySelector(".card-area");
  const canvas = area.querySelector("canvas");
  const form = dialog.querySelector("form");
  const input = form.querySelector("input");
  const submit = form.querySelector("button");
  const msg = dialog.querySelector(".msg");
  let revealed = false;

  // ---- the silver layer ----
  function paintFoil() {
    const ratio = devicePixelRatio || 1;
    const { width, height } = area.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const g = canvas.getContext("2d");
    g.scale(ratio, ratio);
    const grad = g.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "#b9b9c2"); grad.addColorStop(.5, "#e4e4ea"); grad.addColorStop(1, "#a9a9b3");
    g.fillStyle = grad;
    g.fillRect(0, 0, width, height);
    g.fillStyle = "rgba(0,0,0,.05)";   // a little grain so it reads as foil
    for (let i = 0; i < 900; i++) g.fillRect(Math.random() * width, Math.random() * height, 1.5, 1.5);
    g.fillStyle = "#4a4a55";
    g.font = "900 22px Satoshi, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("scratch me ✦", width / 2, height / 2);
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    area.classList.add("revealed");
    dialog.querySelector(".reveal-link").hidden = true;
    submit.disabled = false;
    submit.textContent = "Claim my code";
    input.focus();
  }

  function clearedShare(g) {
    const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
    let clear = 0, n = 0;
    for (let i = 3; i < data.length; i += 4 * 16) { n++; if (data[i] === 0) clear++; }   // every 16th pixel is plenty
    return clear / n;
  }

  // ---- scratching ----
  let drawing = false, last = null, moves = 0;
  const point = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener("pointerdown", e => { drawing = true; last = point(e); canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointerup", () => { drawing = false; });
  canvas.addEventListener("pointercancel", () => { drawing = false; });
  canvas.addEventListener("pointermove", e => {
    if (!drawing || revealed) return;
    const g = canvas.getContext("2d");
    const p = point(e);
    g.globalCompositeOperation = "destination-out";
    g.lineCap = "round";
    g.lineWidth = 34;
    g.beginPath(); g.moveTo(last.x, last.y); g.lineTo(p.x, p.y); g.stroke();
    last = p;
    if (++moves % 12 === 0 && clearedShare(g) > CLEAR_TO_REVEAL) reveal();
  });
  dialog.querySelector(".reveal-link").addEventListener("click", reveal);

  // ---- claiming ----
  form.addEventListener("submit", async e => {
    e.preventDefault();
    if (!revealed) return;
    if (!input.checkValidity()) { msg.textContent = "Enter a valid email address, like name@example.com."; input.focus(); return; }
    if (!CONFIG.kit.discountFormId) { msg.textContent = "Email signup isn't connected yet."; return; }
    submit.disabled = true;
    msg.textContent = "Saving…";
    try {
      await subscribe(CONFIG.kit.discountFormId, input.value.trim());
      write({ state: "claimed", email: input.value.trim() });
      showCode();
    } catch (err) {
      console.error("Scratch card signup failed:", err);
      msg.textContent = "That didn't go through. Try again in a minute.";
      submit.disabled = false;
    }
  });

  function showCode() {
    form.hidden = true;
    msg.textContent = "";
    dialog.querySelector("h2").textContent = `${percent}% off is yours.`;
    dialog.querySelector(".scratch-body > p").textContent = "Use this code at checkout. We've emailed it to you too.";
    const box = document.createElement("div");
    box.innerHTML = `<div class="code-box"><code>${code}</code></div>
      <div class="btns" style="justify-content:center"><button class="btn ghost" type="button" data-copy>Copy code</button><a class="btn" href="checkout.html?p=bundle">Shop now</a></div>`;
    form.after(box);
    box.querySelector("[data-copy]").addEventListener("click", async ev => {
      try { await navigator.clipboard.writeText(code); ev.target.textContent = "Copied"; }
      catch { ev.target.textContent = code; }
    });
  }

  // ---- opening and closing ----
  const close = () => { if (read().state !== "claimed") write({ state: "closed" }); dialog.close(); };
  dialog.querySelector(".scratch-close").addEventListener("click", close);
  dialog.addEventListener("cancel", e => { e.preventDefault(); close(); });                 // Esc
  dialog.addEventListener("click", e => { if (e.target === dialog) close(); });             // click outside the card

  setTimeout(() => {
    if (document.querySelector("dialog[open]")) return;
    dialog.showModal();
    paintFoil();
  }, SHOW_AFTER_MS);
})();
