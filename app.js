
// MSTR Analytics Dashboard - App Logic (v2 with debug + robust URLs)
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,'0');

  console.log("[MSTR] app.js boot");

  // 1) Stamp UTC "Last Revised" using the page's last-modified time
  try {
    const d = new Date(document.lastModified);
    const utc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    const el = $('#last-revised');
    if (el) el.textContent = `Last Revised: ${utc}`;
  } catch(e) {
    console.warn("[MSTR] UTC stamp failed", e);
  }

  // 2) Tab switching
  window.switchTab = function(id){
    $$('.tab').forEach(b => b.classList.remove('active'));
    $$('.tab-content').forEach(c => c.classList.remove('active'));
    const btn = Array.from($$('.tab')).find(b => (b.getAttribute('onclick') || '').includes(`'${id}'`));
    if (btn) btn.classList.add('active');
    const panel = $(`#${id}`);
    if (panel) panel.classList.add('active');
  };

  // 3) Lightweight "calculate" echo so UI never errors
  window.updateValuations = function(){
    const btc = parseFloat($('#current-btc-price')?.value || '0');
    const mstr = parseFloat($('#current-mstr-price')?.value || '0');
    if (!isNaN(btc) && $('#rd-btc-current')) $('#rd-btc-current').textContent = `$${btc.toLocaleString()}`;
    if (!isNaN(mstr) && $('#rd-mstr-current')) $('#rd-mstr-current').textContent = `$${mstr.toFixed(2)}`;
  };

  // 4) Data loader with robust path resolution + debug logs
  async function loadData() {
    const base = new URL('.', location.href); // ends with a /
    const urls = [
      new URL('data.json', base).href,
      new URL('data-3.json', base).href
    ];
    window.__MSTR_DEBUG = { urls }; // visible in console

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

  function setText(sel, val) {
    const el = (sel[0] === '#') ? document.querySelector(sel) : sel;
    if (!el) return;
    el.textContent = val;
  }

  function applyData(d) {
    const raw = d.raw || d;

    if (raw.btc) setText('#rd-btc-current', `$${Number(raw.btc).toLocaleString()}`);
    if (raw.mstr) setText('#rd-mstr-current', `$${Number(raw.mstr).toFixed(2)}`);
    if (document.querySelector('#current-btc-price') && raw.btc) document.querySelector('#current-btc-price').value = Number(raw.btc);
    if (document.querySelector('#current-mstr-price') && raw.mstr) document.querySelector('#current-mstr-price').value = Number(raw.mstr);

    if (raw.nav_floor) setText('#rd-nav-basic', `$${Number(raw.nav_floor)}`);
    if (d.mnv_equity_base) setText('#rd-cur-base', `$${d.mnv_equity_base}`);
    if (d.mnv_equity_inclusion) setText('#rd-cur-incl', `$${d.mnv_equity_inclusion}`);
    if (d.preferred_engine_base) setText('#rd-pref-base', `$${d.preferred_engine_base}`);
    if (d.preferred_engine_inclusion) setText('#rd-pref-incl', `$${d.preferred_engine_inclusion}`);

    if (d.trade?.rec && document.querySelector('#trade')) {
      let target = document.querySelector('#trade .recommendation-box');
      if (!target) {
        target = document.createElement('div');
        target.className = 'recommendation-box';
        target.innerHTML = '<h4>Auto Trade Recommendation</h4><div id="rec-text"></div>';
        document.querySelector('#trade').insertBefore(target, document.querySelector('#trade').firstChild);
      }
      setText('#rec-text', d.trade.rec);
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

  // Kickoff
  loadData();
})();
