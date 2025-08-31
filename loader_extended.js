// loader_extended.js — patches Raw Data + Catalysts panels + Trade Rec from data.json
(async function () {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    const data = await res.json();

    // Update timestamp
    if (data.as_of) {
      const ts = document.querySelector('.last-updated');
      if (ts) ts.textContent = `Last Revised: ${data.as_of}`;
    }

    // --- Raw Data ---
    document.querySelectorAll('.metric').forEach(m => {
      const label = m.querySelector('.metric-label')?.textContent.trim();
      const value = m.querySelector('.metric-value');
      if (!value) return;

      if (label === 'Current BTC Price')
        value.textContent = `$${Number(data.raw_data.btc_price).toLocaleString()}`;
      if (label === 'Current MSTR Price')
        value.textContent = `$${Number(data.raw_data.mstr_price).toFixed(2)}`;
      if (label === 'NAV Floor (Basic Shares)')
        value.textContent = `$${data.raw_data.nav_floor_basic}`;
    });

    // --- Catalysts Timeline (Catalysts tab) ---
    const tableBody = document.querySelector('#catalysts .catalyst-table tbody');
    if (tableBody && data.catalysts?.future?.timeline) {
      tableBody.innerHTML = '';
      data.catalysts.future.timeline.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${row.horizon || ''}</td>
          <td>${row.catalyst || ''}</td>
          <td>${row.date || ''}</td>
          <td>${row.prob || ''}</td>
          <td>${row.impact || ''}</td>
          <td>${row.ngu || ''}</td>`;
        tableBody.appendChild(tr);
      });
    }

    // --- Trade Recommendation (Trade tab) ---
    const recBox = document.querySelector('.recommendation-box');
    if (recBox && data.trade?.recommendation_text) {
      recBox.innerHTML = `
        <h4>Daily Trade Recommendation</h4>
        <p style="margin:0;font-size:.95em;line-height:1.4">
          ${data.trade.recommendation_text}
        </p>`;
    }
  } catch (e) {
    console.error('loader error', e);
  }
})();
