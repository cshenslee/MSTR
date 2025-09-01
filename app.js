
// MSTR Analytics Dashboard - App Logic (v7)
// - Recomputes BOTH Current and EOY tiles using BTC inputs
// - Updates NAV floors too
// - Live updates + Calculate binding + robust JSON loader
(function(){
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,'0');
  console.log("[MSTR] app.js boot v7");

  // ---- Config defaults (can be overridden by data.json) ----
  const CFG = {
    sps_btc: 0.00199121,  // BTC per share
    mult: {
      cur_base: 1.42,
      cur_incl: 1.71,
      pref_base: 1.964,
      pref_incl: 2.507
    }
  };
  function usd(x){ return isFinite(x) ? `$${Math.round(x).toLocaleString()}` : '—'; }

  // preserve status-dot span if present
  function setTile(sel, text){
    const el = $(sel);
    if(!el) return;
    const dot = el.querySelector('.status-dot');
    if (dot) { el.innerHTML = `${text} `; el.appendChild(dot); }
    else { el.textContent = text; }
  }

  // 1) UTC Last Revised baseline
  try{
    const d = new Date(document.lastModified);
    const t = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    const el = $('#last-revised'); if (el) el.textContent = `Last Revised: ${t}`;
  }catch(e){}

  function recomputeSet(prefix, btc){
    const sps = CFG.sps_btc;
    const base = btc * sps; // NAV floor per share
    // targets
    if (prefix === 'cur') {
      setTile('#rd-nav-basic', usd(base));
      setTile('#rd-cur-base', usd(base * CFG.mult.cur_base));
      setTile('#rd-cur-incl', usd(base * CFG.mult.cur_incl));
      setTile('#rd-pref-base', usd(base * CFG.mult.pref_base));
      setTile('#rd-pref-incl', usd(base * CFG.mult.pref_incl));
    } else if (prefix === 'eoy') {
      setTile('#rd-eoy-nav-basic', usd(base));
      setTile('#rd-eoy-cur-base', usd(base * CFG.mult.cur_base));
      setTile('#rd-eoy-cur-incl', usd(base * CFG.mult.cur_incl));
      setTile('#rd-eoy-pref-base', usd(base * CFG.mult.pref_base));
      setTile('#rd-eoy-pref-incl', usd(base * CFG.mult.pref_incl));
    }
  }

  function applyInputs(){
    const btcNow = parseFloat($('#current-btc-price')?.value || 'NaN');
    const mstrNow = parseFloat($('#current-mstr-price')?.value || 'NaN');
    const btcEOY = parseFloat($('#eoy-btc-price')?.value || 'NaN');

    if (!Number.isNaN(btcNow)) {
      setTile('#rd-current-btc', `$${btcNow.toLocaleString()}`);
      setTile('#rd-btc-current', `$${btcNow.toLocaleString()}`);
      recomputeSet('cur', btcNow);
    }
    if (!Number.isNaN(mstrNow)) {
      setTile('#rd-current-mstr', `$${mstrNow.toFixed(2)}`);
      setTile('#rd-mstr-current', `$${mstrNow.toFixed(2)}`);
    }
    if (!Number.isNaN(btcEOY)) {
      recomputeSet('eoy', btcEOY);
    }
  }
  window.updateValuations = function(){ console.log('[MSTR] updateValuations()'); applyInputs(); };

  function bindUI(){
    // Calculate button (bind by text match so we don't care about id)
    let bound=false;
    $$('button, input[type="button"], input[type="submit"]').forEach(b=>{
      const t=(b.value||b.textContent||'').trim().toLowerCase();
      if (!bound && t.includes('calculate')) {
        b.addEventListener('click', window.updateValuations);
        console.log('[MSTR] Bound Calculate to', t);
        bound=true;
      }
    });
    if(!bound) console.warn('[MSTR] Calculate button not found; using live updates only.');

    // Live updates
    ['input','change','blur'].forEach(evt=>{
      ['#current-btc-price','#current-mstr-price','#eoy-btc-price'].forEach(s=>{
        const el=$(s); if(el) el.addEventListener(evt, applyInputs);
      });
    });
  }

  async function loadData(){
    const base = new URL('.', location.href);
    const urls = [new URL('data.json',base).href, new URL('data-3.json',base).href];
    let d=null,src=null; for (const u of urls){ try{ console.log('[MSTR] trying',u); const r=await fetch(u,{cache:'no-store'}); if(!r.ok) continue; d=await r.json(); src=u; break; }catch(e){} }
    if(!d){ console.warn('[MSTR] No data.json'); bindUI(); return; }
    console.log('[MSTR] Loaded:',src);

    // Prefill inputs
    const raw=d.raw||d;
    if (raw?.btc && $('#current-btc-price')) $('#current-btc-price').value=Number(raw.btc);
    if (raw?.mstr && $('#current-mstr-price')) $('#current-mstr-price').value=Number(raw.mstr);

    // Show the prices under Raw Data immediately
    if (raw?.btc){ setTile('#rd-current-btc', `$${Number(raw.btc).toLocaleString()}`); setTile('#rd-btc-current', `$${Number(raw.btc).toLocaleString()}`); }
    if (raw?.mstr){ setTile('#rd-current-mstr', `$${Number(raw.mstr).toFixed(2)}`); setTile('#rd-mstr-current', `$${Number(raw.mstr).toFixed(2)}`); }

    // If JSON provides authoritative prices, derive multipliers so scaling is correct
    try{
      if (typeof d.sps_btc === 'number') CFG.sps_btc = d.sps_btc;
      const denom = (raw?.btc && CFG.sps_btc) ? Number(raw.btc)*CFG.sps_btc : 0;
      if (denom>0){
        if (typeof d.mnv_equity_base === 'number') CFG.mult.cur_base = d.mnv_equity_base/denom;
        if (typeof d.mnv_equity_inclusion === 'number') CFG.mult.cur_incl = d.mnv_equity_inclusion/denom;
        if (typeof d.preferred_engine_base === 'number') CFG.mult.pref_base = d.preferred_engine_base/denom;
        if (typeof d.preferred_engine_inclusion === 'number') CFG.mult.pref_incl = d.preferred_engine_inclusion/denom;
        console.log('[MSTR] Derived multipliers', CFG);
      }
    }catch(e){ console.warn('[MSTR] derive multipliers failed',e); }

    // Compute current + EOY from inputs (EOY from JSON if provided)
    applyInputs();
    if (typeof d.eoy_btc === 'number') { const el=$('#eoy-btc-price'); if (el) el.value = d.eoy_btc; recomputeSet('eoy', d.eoy_btc); }

    // Override header timestamp if JSON provides one
    const asof=d.last_updated || d?.trade_recommendation?.generated_at_utc || d?.meta?.trade_rec_last_generated;
    if (asof){ const dt=new Date(asof.replace(' ','T')+'Z'); if(!isNaN(dt.getTime())){ const el=$('#last-revised'); if(el) el.textContent = `Last Revised: ${dt.toUTCString().replace(' GMT',' UTC')}`; } }

    bindUI();
  }

  if (document.readyState==='loading'){ document.addEventListener('DOMContentLoaded',()=>{ loadData(); }); }
  else { loadData(); }
})();
