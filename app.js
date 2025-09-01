
// MSTR Analytics Dashboard - App Logic (v6)
// Adds calculator logic: recompute fair-value tiles from BTC using SPS & multipliers.
// Reads multipliers from data.json if possible, else falls back to conservative defaults.
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,'0');

  console.log("[MSTR] app.js boot v6");

  // --- Config with fallbacks ---
  const CFG = {
    sps_btc: 0.00199121,        // sats per share in BTC units (≈199,121 sats/sh)
    mnav_base: 1.42,            // equity mNAV baseline (maps to ~$314 at BTC 111,200)
    mnav_incl: 1.71,            // inclusion mNAV (~$379 at 111,200)
    pref_base: 1.964,           // preferred engine base (~$435 at 111,200)
    pref_incl: 2.507            // preferred engine inclusion (~$555 at 111,200)
  };
  window.__MSTR_CFG = CFG;

  function fmtUSD(x) { return isFinite(x) ? `$${Math.round(x).toLocaleString()}` : '—'; }
  function setText(sel, val){ const el = $(sel); if (el) el.textContent = val; }

  // Preserve status dots when updating tiles
  function setTile(sel, text) {
    const el = $(sel);
    if (!el) return;
    const dot = el.querySelector('.status-dot');
    if (dot) { el.innerHTML = `${text} `; el.appendChild(dot); }
    else { el.textContent = text; }
  }

  // 1) Last Revised (UTC)
  try {
    const d = new Date(document.lastModified);
    const utc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    const el = $('#last-revised'); if (el) el.textContent = `Last Revised: ${utc}`;
  } catch (e) {}

  // 2) Calculator: recompute tiles from BTC
  function recomputeFromBTC(btc) {
    const sps = CFG.sps_btc;
    const base = btc * sps;

    const cur_base = base * CFG.mnav_base;
    const cur_incl = base * CFG.mnav_incl;
    const pref_base = base * CFG.pref_base;
    const pref_incl = base * CFG.pref_incl;

    setTile('#rd-cur-base', fmtUSD(cur_base));
    setTile('#rd-cur-incl', fmtUSD(cur_incl));
    setTile('#rd-pref-base', fmtUSD(pref_base));
    setTile('#rd-pref-incl', fmtUSD(pref_incl));
  }

  // 3) Hook inputs → tiles
  function applyInputsToTiles(){
    const btc = parseFloat($('#current-btc-price')?.value || 'NaN');
    const mstr = parseFloat($('#current-mstr-price')?.value || 'NaN');
    if (!Number.isNaN(btc)) { setTile('#rd-btc-current', `$${btc.toLocaleString()}`); setTile('#rd-current-btc', `$${btc.toLocaleString()}`); recomputeFromBTC(btc); }
    if (!Number.isNaN(mstr)) { setTile('#rd-mstr-current', `$${mstr.toFixed(2)}`); setTile('#rd-current-mstr', `$${mstr.toFixed(2)}`); }
  }
  window.updateValuations = function(){ console.log('[MSTR] updateValuations()'); applyInputsToTiles(); };

  function bindCalculate(){
    // bind calculate button by text
    const buttons = $$('button, input[type="button"], input[type="submit"]');
    let bound=false;
    for (const b of buttons) {
      const label = (b.value || b.textContent || '').trim().toLowerCase();
      if (label.includes('calculate')) { b.addEventListener('click', window.updateValuations); bound=true; console.log('[MSTR] Bound Calculate via text:', label); break; }
    }
    if (!bound) console.warn('[MSTR] Calculate button not found; inputs will still live-update.');
    // live input events
    ['input','change','blur'].forEach(evt=>{
      if ($('#current-btc-price')) $('#current-btc-price').addEventListener(evt, applyInputsToTiles);
      if ($('#current-mstr-price')) $('#current-mstr-price').addEventListener(evt, applyInputsToTiles);
    });
  }

  // 4) Data loader → also derive multipliers if JSON provides prices
  async function loadData(){
    const base = new URL('.', location.href);
    const urls = [ new URL('data.json', base).href, new URL('data-3.json', base).href ];
    let d=null, src=null;
    for (const u of urls){
      try{
        console.log('[MSTR] trying', u);
        const r = await fetch(u,{cache:'no-store'});
        if (!r.ok) continue;
        d = await r.json(); src=u; break;
      }catch(e){}
    }
    if(!d){ console.warn('[MSTR] No data.json'); return; }
    console.log('[MSTR] Loaded:', src);

    const raw = d.raw || d;
    if (raw?.btc && $('#current-btc-price')) $('#current-btc-price').value = Number(raw.btc);
    if (raw?.mstr && $('#current-mstr-price')) $('#current-mstr-price').value = Number(raw.mstr);
    if (raw?.btc) { setTile('#rd-btc-current', `$${Number(raw.btc).toLocaleString()}`); setTile('#rd-current-btc', `$${Number(raw.btc).toLocaleString()}`); }
    if (raw?.mstr) { setTile('#rd-mstr-current', `$${Number(raw.mstr).toFixed(2)}`); setTile('#rd-current-mstr', `$${Number(raw.mstr).toFixed(2)}`); }

    // If JSON provides prices & sps, derive multipliers so Calculate scales correctly from new BTC
    try{
      if (typeof d.sps_btc === 'number') CFG.sps_btc = d.sps_btc;
      const sps = CFG.sps_btc;
      const denom = (raw?.btc && sps) ? (sps * Number(raw.btc)) : 0;
      if (denom > 0) {
        if (typeof d.mnv_equity_base === 'number') CFG.mnav_base = d.mnv_equity_base / denom;
        if (typeof d.mnv_equity_inclusion === 'number') CFG.mnav_incl = d.mnv_equity_inclusion / denom;
        if (typeof d.preferred_engine_base === 'number') CFG.pref_base = d.preferred_engine_base / denom;
        if (typeof d.preferred_engine_inclusion === 'number') CFG.pref_incl = d.preferred_engine_inclusion / denom;
        console.log('[MSTR] Derived multipliers:', {mnav_base:CFG.mnav_base, mnav_incl:CFG.mnav_incl, pref_base:CFG.pref_base, pref_incl:CFG.pref_incl, sps:CFG.sps_btc});
      }
    }catch(e){ console.warn('[MSTR] derive multipliers failed', e); }

    // Render initial fair values from current BTC
    if (raw?.btc) recomputeFromBTC(Number(raw.btc));

    // If JSON has authoritative timestamp, override
    const asof = d.last_updated || d?.trade_recommendation?.generated_at_utc || d?.meta?.trade_rec_last_generated;
    if (asof) {
      const dt = new Date(asof.replace(' ','T') + 'Z');
      if (!isNaN(dt.getTime())) { const el = $('#last-revised'); if (el) el.textContent = `Last Revised: ${dt.toUTCString().replace(' GMT',' UTC')}`; }
    }
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { bindCalculate(); loadData(); });
  } else {
    bindCalculate(); loadData();
  }
})();
