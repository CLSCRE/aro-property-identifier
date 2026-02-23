/**
 * Live Rate Feeds — SOFR + Treasury Yields
 * Commercial Lending Solutions — LA Adaptive Reuse Identifier
 *
 * Primary: NY Fed Markets API (SOFR) + Treasury.gov (UST)
 * Fallback: RATE_DEFAULTS from config.js
 * Cache: localStorage with 24-hour TTL
 */

const LiveRates = (() => {
  const CACHE_KEY = 'aro_live_rates';

  let rates = {
    sofr: RATE_DEFAULTS.sofr,
    ust5y: RATE_DEFAULTS.ust5y,
    ust10y: RATE_DEFAULTS.ust10y,
    prime: RATE_DEFAULTS.prime,
    isLive: false,
    fetchedAt: null
  };

  // ─── Cache Management ───

  function loadCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const age = Date.now() - (parsed.fetchedAt || 0);
      if (age < RATE_DEFAULTS.cacheTTL) return parsed;
    } catch (e) { /* ignore */ }
    return null;
  }

  function saveCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
  }

  // ─── Fetch SOFR from NY Fed ───

  async function fetchSOFR() {
    const url = 'https://markets.newyorkfed.org/api/rates/secured/sofr/last/1.json';
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error('NY Fed API returned ' + resp.status);
    const data = await resp.json();
    const rate = data?.refRates?.[0]?.percentRate;
    if (rate == null) throw new Error('No SOFR rate in response');
    return parseFloat(rate);
  }

  // ─── Fetch Treasury yields ───

  async function fetchTreasury() {
    // Treasury.gov XML feed — try to get recent yields
    const url = 'https://data.treasury.gov/feed.svc/DailyTreasuryYieldCurveRateData?$top=1&$orderby=NEW_DATE%20desc&$format=json';
    const resp = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) throw new Error('Treasury API returned ' + resp.status);
    const data = await resp.json();
    const entry = data?.d?.results?.[0] || data?.value?.[0];
    if (!entry) throw new Error('No Treasury data in response');
    return {
      ust5y: parseFloat(entry.BC_5YEAR) || RATE_DEFAULTS.ust5y,
      ust10y: parseFloat(entry.BC_10YEAR) || RATE_DEFAULTS.ust10y
    };
  }

  // ─── Init: Load cache or fetch live ───

  async function init() {
    // Try cache first
    const cached = loadCache();
    if (cached) {
      rates = cached;
      renderRateBar();
      return;
    }

    // Fetch live data
    let sofrLive = false;
    let treasuryLive = false;

    try {
      rates.sofr = await fetchSOFR();
      sofrLive = true;
    } catch (e) {
      console.warn('LiveRates: SOFR fetch failed, using fallback.', e.message);
      rates.sofr = RATE_DEFAULTS.sofr;
    }

    try {
      const ust = await fetchTreasury();
      rates.ust5y = ust.ust5y;
      rates.ust10y = ust.ust10y;
      treasuryLive = true;
    } catch (e) {
      console.warn('LiveRates: Treasury fetch failed, using fallback.', e.message);
      rates.ust5y = RATE_DEFAULTS.ust5y;
      rates.ust10y = RATE_DEFAULTS.ust10y;
    }

    // Derive prime from SOFR (Prime = SOFR + 3.00, rounded to nearest 0.25)
    rates.prime = Math.round((rates.sofr + 3.00) * 4) / 4;

    rates.isLive = sofrLive || treasuryLive;
    rates.fetchedAt = Date.now();

    if (rates.isLive) saveCache(rates);

    renderRateBar();
    updateLoanRateInput();
  }

  // ─── Derived Rates ───

  function getSOFR() { return rates.sofr; }
  function get5YearUST() { return rates.ust5y; }
  function get10YearUST() { return rates.ust10y; }
  function getPrime() { return rates.prime; }

  function getConstructionLoanRate() {
    return Math.round((rates.sofr + RATE_DEFAULTS.spreads.constructionLoan) * 4) / 4;
  }

  function getHTCBridgeRate() {
    return Math.round((rates.sofr + RATE_DEFAULTS.spreads.htcBridge) * 4) / 4;
  }

  function getCMBSRate() {
    return Math.round((rates.ust10y + RATE_DEFAULTS.spreads.cmbs) * 4) / 4;
  }

  function isLive() { return rates.isLive; }

  // ─── Update the construction loan rate input field default ───

  function updateLoanRateInput() {
    const el = document.getElementById('m4-loan-rate');
    if (el && (el.value === '7.5' || el.value === '')) {
      el.value = getConstructionLoanRate().toFixed(2);
    }
  }

  // ─── Rate Bar UI ───

  function renderRateBar() {
    const bar = document.getElementById('live-rate-bar');
    if (!bar) return;

    const status = rates.isLive ? 'live' : 'fallback';
    const dotClass = rates.isLive ? 'rate-dot-live' : 'rate-dot-fallback';
    const statusLabel = rates.isLive ? 'LIVE' : 'FALLBACK';

    const items = [
      { label: 'SOFR', value: rates.sofr.toFixed(2) + '%' },
      { label: '5Y UST', value: rates.ust5y.toFixed(2) + '%' },
      { label: '10Y UST', value: rates.ust10y.toFixed(2) + '%' },
      { label: 'PRIME', value: rates.prime.toFixed(2) + '%' },
      { label: 'CONSTR', value: getConstructionLoanRate().toFixed(2) + '%', derived: true },
      { label: 'HTC BRIDGE', value: getHTCBridgeRate().toFixed(2) + '%', derived: true }
    ];

    bar.innerHTML = `
      <div class="rate-bar-inner">
        <div class="rate-bar-status">
          <span class="${dotClass}"></span>
          <span class="rate-bar-status-label">${statusLabel}</span>
        </div>
        <div class="rate-bar-items">
          ${items.map(i => `
            <span class="rate-bar-item${i.derived ? ' derived' : ''}">
              <span class="rate-bar-label">${i.label}</span>
              <span class="rate-bar-value">${i.value}</span>
            </span>
          `).join('<span class="rate-bar-sep">|</span>')}
        </div>
      </div>
    `;
  }

  return {
    init,
    getSOFR,
    get5YearUST,
    get10YearUST,
    getPrime,
    getConstructionLoanRate,
    getHTCBridgeRate,
    getCMBSRate,
    isLive,
    updateLoanRateInput,
    renderRateBar
  };
})();
