// MSTR Analytics Dashboard - App Logic
// - UTC "Last Revised" from document.lastModified
// - Data loader for ./data.json (fallback to ./data-3.json)
// - Basic tab switching (switchTab)
// - Safe DOM updates for known IDs

(function(){
  // Helpers
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const pad = (n) => String(n).padStart(2,'0');

  // 1) Stamp UTC "Last Revised" using the page's last-modified time
  try {
    const d = new Date(document.lastModified);
    const utc = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
    const el = $('#last-revised');
    if (el) el.textContent = `Last Revised: ${utc}`;
  } catch(e) {
    console.warn("UTC stamp failed", e);
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

  // 3) Update Valuations – lightweight calculator placeholder (prevents errors)
  window.updateValuations = function(){
    // This just reflects user inputs into the Raw Data tiles for now.
    const btc = parseFloat($('#current-btc-price')?.value || '0');
    const mstr = parseFloat($('#current-mstr-price')?.value || '0');
    if (!isNaN(btc) && $('#rd-current-btc')) $('#rd-current-btc').firstChild.nodeValue = `$${btc.toLocaleString()}`;
    if (!isNaN(mstr) && $('#rd-current-mstr')) $('#rd-current-mstr').firstChild.nodeValue = `$${mstr.toFixed(2)}`;
  };

  // 4) Data loader
  async function loadData() {
    const urls = ['./data.json', './data-3.json']; // prefer data.json (GitHub Action), fallback to data-3.json
    let data = null, lastUrl = null, error = null;
    for (const u of urls) {
      try {
        const res = await fetch(u, { cache: 'no-store' });
        if (res.ok) {
          data = await res.json();
          lastUrl = u;
          break;
        }
      } catch (e) {
        error = e;
      }
    }
    if (!data) {
      console.warn('No data file found (tried data.json, data-3.json)', error);
      return;
    }
    try {
      applyData(data);
      // If JSON has last_updated or generated_at_utc, override visible stamp to "data-asof (UTC)"
      const asof = data.last_updated || data?.trade_recommendation?.generated_at_utc || data?.meta?.trade_rec_last_generated;
      if (asof) {
        const dt = new Date(asof.replace(' ', 'T') + 'Z');
        if (!isNaN(dt.getTime())) {
          const el = $('#last-revised');
          if (el) el.textContent = `Last Revised: ${dt.toUTCString().replace(' GMT',' UTC')}`;
        }
      }
      console.log('Loaded:', lastUrl);
    } catch(e) {
      console.error('applyData failed', e);
    }
  }

  function setText(id, val, formatter) {
    const el = $(id);
    if (!el) return;
    if (formatter) el.textContent = formatter(val);
    else el.textContent = val;
  }

  function applyData(d) {
    // Support both flat and nested shapes from analyzer.py
    const raw = d.raw || d;

    // Prices
    if (raw.btc) setText('#rd-btc-current', `$${Number(raw.btc).toLocaleString()} `);
    if (raw.mstr) setText('#rd-mstr-current', `$${Number(raw.mstr).toFixed(2)} `);

    // Also reflect into the header input defaults if present
    if ($('#current-btc-price') && raw.btc) $('#current-btc-price').value = Number(raw.btc);
    if ($('#current-mstr-price') && raw.mstr) $('#current-mstr-price').value = Number(raw.mstr);

    // Fair-value tiles (if provided)
    if (raw.nav_floor) setText('#rd-nav-basic', `$${Number(raw.nav_floor)}`);
    // Sample mapping from your earlier numbers (optional)
    if (d.mnv_equity_base) setText('#rd-cur-base', `$${d.mnv_equity_base}`);
    if (d.mnv_equity_inclusion) setText('#rd-cur-incl', `$${d.mnv_equity_inclusion}`);
    if (d.preferred_engine_base) setText('#rd-pref-base', `$${d.preferred_engine_base}`);
    if (d.preferred_engine_inclusion) setText('#rd-pref-incl', `$${d.preferred_engine_inclusion}`);

    // Tripwires / trade
    if (d.trade?.rec && $('#trade')) {
      // Put the recommendation text at the top of the Trade tab if you like
      let target = $('#trade').querySelector('.recommendation-box');
      if (!target) {
        // inject a simple box
        target = document.createElement('div');
        target.className = 'recommendation-box';
        target.innerHTML = '<h4>Auto Trade Recommendation</h4><div id="rec-text"></div>';
        $('#trade').insertBefore(target, $('#trade').firstChild);
      }
      $('#rec-text').textContent = d.trade.rec;
    }

    // Populate the "Raw Data" header BLUF with a quick summary if available
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