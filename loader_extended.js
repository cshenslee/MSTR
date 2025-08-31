/* loader_extended.js — safe, small, and defensive */
(function () {
  const byText = (selector, exact) => {
    const nodes = document.querySelectorAll(selector);
    for (const n of nodes) if (n.textContent.trim() === exact) return n;
    return null;
  };

  const setMetric = (labelText, valueHtml) => {
    const label = byText('.metric .metric-label', labelText);
    if (!label) return;
    const value = label.parentElement.querySelector('.metric-value');
    if (!value) return;
    const dot = value.querySelector('.status-dot');
    value.innerHTML = valueHtml;
    if (dot) value.appendChild(dot);
  };

  const setLastUpdated = (iso) => {
    const el = document.querySelector('.last-updated');
    if (!el) return;
    const d = iso ? new Date(iso) : new Date();
    const pst = new Date(d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    const stamped = pst.toISOString().replace('T', ' ').substring(0, 16) + ' PT';
    el.textContent = `Last Revised: ${stamped}`;
  };
  window.__setLastUpdated = setLastUpdated;

  const fillTable = (tbody, rows, columns) => {
    if (!tbody || !Array.isArray(rows)) return;
    tbody.innerHTML = rows.map(r => {
      return `<tr>${columns.map(k => `<td>${(r && r[k] != null) ? r[k] : ''}</td>`).join('')}</tr>`;
    }).join('');
  };

  async function load() {
    let data;
    try {
      const res = await fetch('data.json?ts=' + Date.now());
      data = await res.json();
    } catch (e) {
      console.error('data.json load failed', e);
      return;
    }

    if (data.last_updated) setLastUpdated(data.last_updated);

    // RAW DATA
    if (data.raw) {
      if (data.raw.btc != null)  setMetric('Current BTC Price', `$${Number(data.raw.btc).toLocaleString()}`);
      if (data.raw.mstr != null) setMetric('Current MSTR Price', `$${Number(data.raw.mstr).toLocaleString()}`);
      if (data.raw.nav_floor != null) setMetric('NAV Floor (Basic Shares)', `$${Math.round(data.raw.nav_floor).toLocaleString()}`);
    }

    // CATALYSTS — Future Timeline
    const catBody = document.querySelector('#cat_timeline_body') ||
                    document.querySelectorAll('table.catalyst-table tbody')[0];
    if (Array.isArray(data.catalysts)) {
      fillTable(catBody, data.catalysts, ['horizon', 'catalyst', 'date', 'prob', 'impact', 'ngu']);
    }

    // MEDIA table (if present)
    const mediaBody = document.querySelector('#media_table_body');
    if (mediaBody && Array.isArray(data.media)) {
      fillTable(mediaBody, data.media, ['theme','signal','implication','status']);
    }

    // MACRO signals table (if present)
    const macroBody = document.querySelector('#macro_signals_body');
    if (macroBody && Array.isArray(data.macro_signals)) {
      fillTable(macroBody, data.macro_signals, ['signal','latest','implication','status']);
    }

    // INSTITUTIONAL table (if present)
    const instBody = document.querySelector('#inst_table_body');
    if (instBody && Array.isArray(data.institutions)) {
      fillTable(instBody, data.institutions, ['rank','name','shares','last','trend','status']);
    }

    // CORPORATE activity (if present)
    const corpBody = document.querySelector('#corp_activity_body');
    if (corpBody && Array.isArray(data.corporate)) {
      fillTable(corpBody, data.corporate, ['date','entity','amount_btc','usd','notes','sig']);
    }

    // REGULATORY blocks (if present)
    const regLive = document.querySelector('#reg_live_body');
    if (regLive && Array.isArray(data.reg_live)) {
      fillTable(regLive, data.reg_live, ['item','status']);
    }
    const regPend = document.querySelector('#reg_pending_body');
    if (regPend && Array.isArray(data.reg_pending)) {
      fillTable(regPend, data.reg_pending, ['item','status']);
    }

    // TRADE — Rec text
    const recText = document.querySelector('#trade_rec_text') || document.querySelector('.recommendation-box');
    if (recText && data.trade?.rec) {
      if (recText.classList && recText.classList.contains('recommendation-box')) {
        recText.innerHTML = `<h4>Today's Actions</h4><p>${data.trade.rec}</p>`;
      } else {
        recText.textContent = data.trade.rec;
      }
    }

    // Add timestamp if available
const ts = data?.meta?.trade_rec_last_generated || data?.trade_recommendation?.generated_at_utc;
const elTs = document.getElementById('trade-rec-ts');
if (elTs && ts) {
  elTs.textContent = `(auto @ ${ts} UTC)`;
}

// HEADER — Last Revised (always show UTC, no conversion)
{
  const srcIso =
    (data?.meta && data.meta.last_updated_utc) ||
    (data?.trade_recommendation && data.trade_recommendation.generated_at_utc) ||
    null;

  const lastEl = document.querySelector('.last-updated');
  if (lastEl) {
    // helper to drop seconds and the trailing 'Z'
    const toUtcStamp = (iso) =>
      iso
        .replace('T', ' ')
        .replace(/:\d{2}(?:\.\d+)?Z?$/, ''); // trim :ss(.ms) and Z

    const stamp = srcIso
      ? toUtcStamp(srcIso)
      : toUtcStamp(new Date().toISOString());

    lastEl.textContent = `Last Revised: ${stamp} UTC`;
  }
}
    
    const stamp = srcIso
      ? toUtcStamp(srcIso)
      : toUtcStamp(new Date().toISOString());

    lastEl.textContent = `Last Revised: ${stamp} UTC`;
  }
}

    const stamp = srcIso
      ? toUtcStamp(srcIso)
      : toUtcStamp(new Date().toISOString());

    lastEl.textContent = `Last Revised: ${stamp} UTC`;
  }
}
   
    // TRADE — Scenarios
    const scenBody = document.querySelector('#scenarios_body');
    if (scenBody && Array.isArray(data.trade?.scenarios)) {
      fillTable(scenBody, data.trade.scenarios, ['name','prob','btc','mstr']);
    }

    // TRADE — Tripwires
    const twBody = document.querySelector('#tripwires_body');
    if (twBody && Array.isArray(data.trade?.tripwires)) {
      fillTable(twBody, data.trade.tripwires, ['signal','current','status','critical']);
    }
  }

  load().catch(console.error);
})();
