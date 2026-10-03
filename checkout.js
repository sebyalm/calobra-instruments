// Checkout page: pick a plugin or the bundle, add a discount code, then pay through
// Lemon Squeezy's overlay. Lemon Squeezy sells one product per checkout, so this is a single pick.
(() => {
  const SCRATCH_KEY = "calobra-scratch";
  const PAID = PLUGINS.filter(p => CONFIG.prices[p.key].full > 0);
  const OPTIONS = [
    { key: "bundle", name: "The bundle", kind: "All five plugins, Lucha Effects included", page: "index.html#bundle" },
    ...PAID,
  ];

  const list = document.getElementById("picks");
  const summary = {
    name: document.getElementById("sum-name"),
    kind: document.getElementById("sum-kind"),
    price: document.getElementById("sum-price"),
    discountRow: document.getElementById("sum-discount"),
    discountLabel: document.getElementById("sum-discount-label"),
    discountAmount: document.getElementById("sum-discount-amount"),
    total: document.getElementById("sum-total"),
    upsell: document.getElementById("upsell"),
  };
  const codeInput = document.getElementById("code");
  const codeMsg = document.getElementById("code-msg");
  const emailInput = document.getElementById("email");
  const pay = document.getElementById("pay");
  const payMsg = document.getElementById("pay-msg");

  let picked = new URLSearchParams(location.search).get("p");
  if (!OPTIONS.some(o => o.key === picked)) picked = "bundle";
  let appliedCode = "";

  // ---- the choices ----
  OPTIONS.forEach(o => {
    const label = document.createElement("label");
    label.className = "pick" + (o.key === "bundle" ? " pick-bundle" : "");
    if (o.key !== "bundle") label.dataset.p = o.key;
    const save = CONFIG.prices[o.key].full - nowPrice(o.key);
    label.innerHTML = `
      <input type="radio" name="product" value="${o.key}" ${o.key === picked ? "checked" : ""}>
      <span class="pick-thumb">${o.key === "bundle"
        ? PLUGINS.map(p => `<i data-p="${p.key}"></i>`).join("")
        : `<img src="img/${o.key}.webp" alt="" loading="lazy">`}</span>
      <span class="pick-text"><b>${o.name}</b><small>${o.kind}</small>
        ${o.key === "bundle" && save > 0 ? `<em>Best value · save ${money(save)}</em>` : ""}</span>
      <span class="pick-price">${wasHtml(o.key)}<strong>${money(nowPrice(o.key))}</strong></span>`;
    list.append(label);
  });
  list.addEventListener("change", e => { picked = e.target.value; paint(); });

  // ---- discount code ----
  const knownCode = c => c.toUpperCase() === CONFIG.discount.code.toUpperCase();
  function applyCode() {
    const c = codeInput.value.trim();
    appliedCode = c;
    if (!c) codeMsg.textContent = "";
    else if (knownCode(c)) codeMsg.textContent = `${CONFIG.discount.percent}% off applied.`;
    else codeMsg.textContent = "We'll check this code when you pay.";
    paint();
  }
  document.getElementById("code-form").addEventListener("submit", e => { e.preventDefault(); applyCode(); });

  // a code and email won from the scratch card fill themselves in
  try {
    const won = JSON.parse(localStorage.getItem(SCRATCH_KEY)) || {};
    if (won.state === "claimed") {
      codeInput.value = CONFIG.discount.code;
      if (won.email) emailInput.value = won.email;
      applyCode();
    }
  } catch { /* storage blocked: nothing to prefill */ }

  // ---- summary ----
  function paint() {
    const o = OPTIONS.find(x => x.key === picked);
    const price = nowPrice(o.key);
    const off = appliedCode && knownCode(appliedCode) ? Math.round(price * CONFIG.discount.percent) / 100 : 0;
    summary.name.textContent = o.name;
    summary.kind.textContent = o.kind;
    summary.price.innerHTML = `${wasHtml(o.key)} ${money(price)}`;
    summary.discountRow.hidden = !off;
    summary.discountLabel.textContent = `${appliedCode.toUpperCase()} · ${CONFIG.discount.percent}% off`;
    summary.discountAmount.textContent = "−" + money(off);
    summary.total.textContent = money(Math.round((price - off) * 100) / 100);

    const extra = nowPrice("bundle") - price;
    summary.upsell.hidden = o.key === "bundle" || extra <= 0;
    summary.upsell.textContent = `Get all five for ${money(extra)} more →`;

    const ready = Boolean(CONFIG.checkout[o.key]);
    pay.disabled = !ready;
    payMsg.textContent = ready ? "" : "Checkout isn't connected yet.";
  }
  summary.upsell.addEventListener("click", () => {
    picked = "bundle";
    list.querySelector('input[value="bundle"]').checked = true;
    paint();
  });

  // ---- pay ----
  function checkoutUrl() {
    const url = new URL(CONFIG.checkout[picked]);
    url.searchParams.set("embed", "1");
    if (appliedCode) url.searchParams.set("checkout[discount_code]", appliedCode);
    const email = emailInput.value.trim();
    if (email && emailInput.checkValidity()) url.searchParams.set("checkout[email]", email);
    return url.toString();
  }

  pay.addEventListener("click", () => {
    if (!CONFIG.checkout[picked]) return;
    if (emailInput.value && !emailInput.checkValidity()) { payMsg.textContent = "Check your email address, or leave it empty."; emailInput.focus(); return; }
    let url;
    try { url = checkoutUrl(); }
    catch (err) {
      console.error(`CONFIG.checkout.${picked} is not a valid link:`, err);
      payMsg.textContent = "This checkout link is broken. Please try again later.";
      return;
    }
    try {
      window.createLemonSqueezy?.();
      if (window.LemonSqueezy) { window.LemonSqueezy.Url.Open(url); return; }
    } catch (err) {
      console.error("Lemon Squeezy overlay failed, opening the page instead:", err);
    }
    location.href = url;   // overlay script blocked or missing: the hosted checkout page works the same
  });

  paint();
})();
