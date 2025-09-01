
// MSTR Analytics Dashboard - App Logic (v4: robust Calculate binding + live input updates)
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,'0');

  console.log("[MSTR] app.js boot v4");

  // Preserve a trailing .status-dot span when updating text
  function setMetricPreserveDot(el, text) {
    if (!el) return;
    const dot = el.querySelector('.status-dot');
    if (dot) {
      el.innerHTML = `${text} `;
      el.appendChild(dot);
    } else {
      el.textContent = text;
    }
  }
  function setMetricAny(selectors, text) {
    selectors.forEach(sel => {
      const el = $(sel);
      if (el) setMetricPreserveDot(el, text);
    });
  }

  // 1) Stamp UTC "Last Revised" using the page's last-modified time
  try {
    const d = new Date(document.lastModified);
    const utc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    const el = $('#last-revised');
    if (el) el.textContent = `Last Revised: ${utc}`;
  } catch(e) {
    console.warn("[MSTR] UTC stamp failed", e);
  }

  // 2) The function that applies the two input values to the Raw Data tiles
  function applyInputsToTiles() {
    const btcVal = parseFloat($('#current-btc-price')?.value || 'NaN');
    const mstrVal = parseFloat($('#current-mstr-price')?.value || 'NaN');
    if (!Number.isNaN(btcVal)) {
      setMetricAny(['#rd-btc-current', '#rd-current-btc'], `$${btcVal.toLocaleString()}`);
    }
    if (!Number.isNaN(mstrVal)) {
      setMetricAny(['#rd-mstr-current', '#rd-current-mstr'], `$${mstrVal.toFixed(2)}`);
    }
  }

  // 3) Expose for inline onclick (in case the HTML already has it)
  window.updateValuations = function(){
    console.log("[MSTR] updateValuations() called");
    applyInputsToTiles();
  };

  // 4) Robust binding for the "Calculate" button and live updates
  function bindCalculate() {
    const candidates = [
      '#calculate', '#calculate-btn', '#calc', '#btn-calc',
      'button[data-action="calculate"]', 'button[data-role="calculate"]',
      'input[type="button"][value="Calculate"]', 'input[type="submit"][value="Calculate"]'
    ];
    let bound = false;

    // Try common id/class/data selectors first
    for (const sel of candidates) {
      const btn = $(sel);
      if (btn) {
        btn.addEventListener('click', window.updateValuations);
        console.log(`[MSTR] Bound Calculate via selector: ${sel}`);
        bound = true;
        break;
      }
    }

    // Fallback: any button whose text includes "calculate"
    if (!bound) {
      const buttons = $$('button, input[type="button"], input[type="submit"]');
      for (const b of buttons) {
        const label = (b.value || b.textContent || '').trim().toLowerCase();
        if (label.includes('calculate')) {
          b.addEventListener('click', window.updateValuations);
          console.log("[MSTR] Bound Calculate via text match:", label);
          bound = true;
          break;
        }
      }
    }

    // Live updates as the user types / changes the inputs
    const btcInput = $('#current-btc-price');
    const mstrInput = $('#current-mstr-price');
    ['input', 'change', 'blur'].forEach(evt => {
      if (btcInput) btcInput.addEventListener(evt, applyInputsToTiles);
      if (mstrInput) mstrInput.addEventListener(evt, applyInputsToTiles);
    });

    if (!bound) {
      console.warn("[MSTR] Calculate button not found. Inputs will still live-update tiles.");
    }
  }

  // 5) Data loader (unchanged from v3, with logs)
  async function loadData() {
    const base = new URL('.', location.href); // ends with a /
    const urls = [
      new URL('data.json', base).href,
      new URL('data-3.json', base).href
    ];
    window.__MSTR_DEBUG = { urls };

    let data = null, fromUrl = null, lastErr = null;
    for (const u of urls) {
      try {
        console.log("[MSTR] trying", u);
        const res = await fetch(u, { cache: 'no-store' });
        if (!res.ok) { console.warn("[MSTR] fetch not ok", u, res.status); continue; }
        data = await res.json();
        fromUrl = u;
        break;
      } catch (e) {
        lastErr = e;
        console.warn("[MSTR] fetch failed", u, e);
      }
    }
    if (!data) {
      console.warn("[MSTR] No data.json or data-3.json found", lastErr);
      return;
    }
    console.log("[MSTR] Loaded:", fromUrl);
    try {
      applyData(data);
      const asof = data.last_updated || data?.trade_recommendation?.generated_at_utc || data?.meta?.trade_rec_last_generated;
      if (asof) {
        const dt = new Date(asof.replace(' ', 'T') + 'Z');
        if (!isNaN(dt.getTime())) {
          const el = $('#last-revised');
          if (el) el.textContent = `Last Revised: ${dt.toUTCString().replace(' GMT',' UTC')}`;
        }
      }
    } catch(e) {
      console.error("[MSTR] applyData failed", e);
    }
  }

  function applyData(d) {
    const raw = d.raw || d;

    if (raw.btc) setMetricAny(['#rd-btc-current', '#rd-current-btc'], `$${Number(raw.btc).toLocaleString()}`);
    if (raw.mstr) setMetricAny(['#rd-mstr-current', '#rd-current-mstr'], `$${Number(raw.mstr).toFixed(2)}`);

    if ($('#current-btc-price') && raw.btc) $('#current-btc-price').value = Number(raw.btc);
    if ($('#current-mstr-price') && raw.mstr) $('#current-mstr-price').value = Number(raw.mstr);

    if (raw.nav_floor) setMetricAny(['#rd-nav-basic'], `$${Number(raw.nav_floor)}`);
    if (d.mnv_equity_base) setMetricAny(['#rd-cur-base'], `$${d.mnv_equity_base}`);
    if (d.mnv_equity_inclusion) setMetricAny(['#rd-cur-incl'], `$${d.mnv_equity_inclusion}`);
    if (d.preferred_engine_base) setMetricAny(['#rd-pref-base'], `$${d.preferred_engine_base}`);
    if (d.preferred_engine_inclusion) setMetricAny(['#rd-pref-incl'], `$${d.preferred_engine_inclusion}`);

    if (d.trade?.rec && $('#trade')) {
      let target = $('#trade .recommendation-box');
      if (!target) {
        target = document.createElement('div');
        target.className = 'recommendation-box';
        target.innerHTML = '<h4>Auto Trade Recommendation</h4><div id="rec-text"></div>';
        $('#trade').insertBefore(target, $('#trade').firstChild);
      }
      $('#rec-text').textContent = d.trade.rec;
    }

    const bluf = d?.trade_recommendation?.core_position;
    if (bluf) {
      const box = document.querySelector('#rawdata .bluf');
      if (box) {
        box.innerHTML = `<strong>BLUF:</strong> Core: ${bluf}. ` +
          (d.trade_recommendation.risk_management ? `Risk: ${d.trade_recommendation.risk_management}.` : '');
      }
    }
  }

  // Kickoff after DOM is ready to ensure elements exist
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bindCalculate(); loadData(); });
  } else {
    bindCalculate(); loadData();
  }
})();
