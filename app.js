
// MSTR Analytics Dashboard - App Logic (v8)
// Key change: DO NOT override existing window.updateValuations defined in HTML.
// We bind the Calculate button (and input-change events) to call the page's own calculator.
// We still: stamp UTC, prefill inputs from data.json, render Trade Rec safely.
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,'0');
  console.log("[MSTR] app.js boot v8");

  // 1) Stamp UTC "Last Revised" using the page's last-modified time
  try {
    const d = new Date(document.lastModified);
    const utc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    const el = $('#last-revised'); if (el) el.textContent = `Last Revised: ${utc}`;
  } catch(e) { console.warn("[MSTR] UTC stamp failed", e); }

  // 2) Hook the page's existing calculator (if present)
  function bindCalculateToPageFn(){
    const pageCalc = (typeof window.updateValuations === 'function') ? window.updateValuations : null;
    if (!pageCalc) { console.warn("[MSTR] Page calculator not found (window.updateValuations)."); return; }

    let bound = false;
    const candidates = [
      '#calculate', '#calculate-btn', '#calc', '#btn-calc',
      'button.main-update-btn', 'button[data-action="calculate"]',
      'input[type="button"][value*="Calculate"]', 'input[type="submit"][value*="Calculate"]'
    ];
    for (const sel of candidates) {
      const btn = $(sel);
      if (btn) {
        btn.addEventListener('click', pageCalc);
        console.log(`[MSTR] Bound Calculate → page function via ${sel}`);
        bound = true; break;
      }
    }
    if (!bound) {
      const buttons = $$('button, input[type="button"], input[type="submit"]');
      for (const b of buttons) {
        const label = (b.value || b.textContent || '').trim().toLowerCase();
        if (label.includes('calculate')) {
          b.addEventListener('click', pageCalc);
          console.log("[MSTR] Bound Calculate → page function via text:", label);
          bound = true; break;
        }
      }
    }

    // inputs trigger recalculation automatically
    const inputs = ['#current-btc-price', '#eoy-btc-price', '#current-mstr-price']
      .map(sel => $(sel)).filter(Boolean);
    ['input','change','blur'].forEach(evt => {
      inputs.forEach(inp => inp.addEventListener(evt, () => {
        try { pageCalc(); } catch(e){ console.warn("[MSTR] pageCalc error on input event", e); }
      }));
    });

    if (!bound) console.warn("[MSTR] Calculate button not found, but inputs will still re-run pageCalc().");
  }

  // 3) Data loader: prefill inputs; do NOT compute tiles here (leave to pageCalc)
  async function loadData(){
    const base = new URL('.', location.href);
    const urls = [ new URL('data.json', base).href, new URL('data-3.json', base).href ];
    let d=null, src=null;
    for (const u of urls){
      try{ const r = await fetch(u, {cache:'no-store'}); if (!r.ok) continue; d = await r.json(); src=u; break; }catch(e){}
    }
    if (!d) { console.warn("[MSTR] No data.json found"); return; }
    console.log("[MSTR] Loaded:", src);

    const raw = d.raw || d;
    if (raw?.btc && $('#current-btc-price')) $('#current-btc-price').value = Number(raw.btc);
    if (raw?.mstr && $('#current-mstr-price')) $('#current-mstr-price').value = Number(raw.mstr);
    if (raw?.eoy_btc && $('#eoy-btc-price')) $('#eoy-btc-price').value = Number(raw.eoy_btc);

    // If JSON provides authoritative timestamp, override header
    const asof = d.last_updated || d?.trade_recommendation?.generated_at_utc || d?.meta?.trade_rec_last_generated;
    if (asof) {
      const dt = new Date(asof.replace(' ','T') + 'Z');
      if (!isNaN(dt.getTime())) { const el = $('#last-revised'); if (el) el.textContent = `Last Revised: ${dt.toUTCString().replace(' GMT',' UTC')}`; }
    }

    // Trade Rec safe render
    if (d.trade?.rec && $('#trade')) {
      let box = $('#trade .recommendation-box');
      if (!box) {
        box = document.createElement('div');
        box.className = 'recommendation-box';
        const h = document.createElement('h4'); h.textContent = 'Auto Trade Recommendation';
        const recDiv = document.createElement('div'); recDiv.setAttribute('data-rec','1');
        box.appendChild(h); box.appendChild(recDiv);
        $('#trade').insertBefore(box, $('#trade').firstChild);
      }
      const recTarget = $('#trade .recommendation-box [data-rec]');
      if (recTarget) recTarget.textContent = d.trade.rec;
    }

    // After prefill, run the page's calculator once
    if (typeof window.updateValuations === 'function') {
      try { window.updateValuations(); } catch(e){ console.warn("[MSTR] pageCalc error after data load", e); }
    }
  }

  // Start after DOM is ready so the page function exists
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bindCalculateToPageFn(); loadData(); });
  } else {
    bindCalculateToPageFn(); loadData();
  }
})();
