/**
 * ALPHA PENNY // Forensic Micro-Cap & Multi-Bagger Screener Terminal
 * Client-Side Engine:
 * - Hybrid Real-Data Architecture (Pre-fetched 451 US/EU Micro-Caps + Live Browser Scanner API Refresh)
 * - 4-Pillar Forensic Scoring & 12 Strategy Presets
 * - SEC EDGAR 13D/13G, Form 4, S-3 & 424B5 ATM Radar
 * - Interactive 4-Pillar Due Diligence Lab & Cash Runway Simulator
 * - Asymmetric Execution, Position Sizing (1-3%) & CRV (>=3:1) Calculator
 * - Modern Web Guidance compliance: SPA content-visibility state caching, native <dialog> light-dismiss fallback
 */

const state = {
  stocks: [],
  filtered: [],
  watchlist: new Set(JSON.parse(localStorage.getItem('alphaPennyWatchlist') || '[]')),
  activePreset: 'ALL',
  sortField: 'score',
  sortAsc: false,
  selectedStock: null,
};

const PRESET_DEFINITIONS = {
  ALL: {
    title: 'Gesamtes Micro-Cap Universum (NASDAQ, NYSE & Europa):',
    desc: 'Zeigt alle 450+ überwachten Pennystocks inkl. 4-Säulen-Forensik-Score, Cash Runway in Monaten, echten SEC EDGAR Filings (S-3, 424B5, 13D/13G) und algorithmischer Entry-Zone.',
    apply: () => resetFilterInputs(),
  },
  ENTRY_ALERT: {
    title: '🎯 Aktive Entry-Alerts (100-Punkte Confluence-Score ≥ 80):',
    desc: 'Filtert Aktien mit höchster Liquiditätskonfluenz (Score ≥ 80/100 aus Trend > SMA200/HL, Golden-Pocket 0.618–0.786 / AVWAP / Squeeze, Volume Dry-Up im Pullback & engem Spread < 1,5 %).',
    apply: () => resetFilterInputs(),
  },
  GOLDEN_POCKET: {
    title: '📐 Golden-Pocket Pullback-Zone (Fibonacci 0.618 – 0.786 Retest):',
    desc: 'Nach dem ersten Impuls (Leg 1) korrigiert der Kurs in die institutionelle 61,8 % – 78,6 % Liquiditätszone (Invalidation / Hard Stop bei 88,6 % Retracement).',
    apply: () => resetFilterInputs(),
  },
  BB_KC_SQUEEZE: {
    title: '🗜️ Bollinger / Keltner Volatility Squeeze (Pre-Breakout Kompression):',
    desc: 'Bollinger Bänder (20, 2.0σ) liegen innerhalb der Keltner Channels (20, 1.5×ATR): Maximale Volatilitäts-Kontraktion vor dem impulsiven Ausbruch über den SMA 20.',
    apply: () => resetFilterInputs(),
  },
  AVWAP_SUPPORT: {
    title: '⚓ Anchor-VWAP & Volume-Profile (VPOC / VAH) Support-Retest:',
    desc: 'Kurs testet das dynamische Anchor-VWAP-Band bzw. das obere Ende der Value Area (VAH = 70 % Volumen-Zone) als institutionelles Unterstützungsniveau.',
    apply: () => resetFilterInputs(),
  },
  SAFE_STANDARD: {
    title: '1. Basis-Qualitäts-Setup ("Safe Standard" – Rauschen ausblenden):',
    desc: 'NASDAQ & NYSE (kein OTC!), Kursspanne 0,80 $ bis 5,00 $, Marktkapitalisierung 30 Mio. $ bis 300 Mio. $, Average Volume (3M) > 300.000 Aktien für enge Spreads.',
    apply: () => {
      resetFilterInputs();
      setVal('f-region', 'US');
      setVal('f-price-min', '0.80');
      setVal('f-price-max', '5.00');
      setVal('f-mcap-min', '30');
      setVal('f-mcap-max', '300');
      setVal('f-vol-min', '300000');
    },
  },
  REVENUE_ACCEL: {
    title: 'Setup 1: Umsatz-Beschleunigung & Skalierung ("Growth Scaler"):',
    desc: 'Findet Unternehmen, deren Geschäftsmodell skaliert, bevor Großinvestoren einsteigen: Starkes Umsatz- & EPS-Wachstum (Sales Q/Q bzw. YoY > 25–30 %), Debt/Equity < 1.0, Kurs ≥ 1,00 $.',
    apply: () => {
      resetFilterInputs();
      setVal('f-price-min', '0.95');
      setVal('f-price-max', '5.00');
    },
  },
  ACCUMULATION: {
    title: 'Setup 2: Bodenbildung & Smart-Money-Akkumulation:',
    desc: 'Erkennt stilles Einsammeln von Aktien vor dem Ausbruch: Kurs notiert über SMA 50 und SMA 200 in geordneter Konsolidierungs-Range mit solider Liquidität.',
    apply: () => {
      resetFilterInputs();
      setChecked('chk-above-sma', true);
    },
  },
  UNUSUAL_RVOL: {
    title: 'Setup 3: Ungewöhnliches Volumen & Momentum-Ausbruch (RVOL > 2.0):',
    desc: 'Identifiziert den exakten Tag, an dem frisches institutionelles oder breites Marktvolumen und neue Katalysatoren auf einen begrenzten Float treffen.',
    apply: () => {
      resetFilterInputs();
      setVal('f-rvol-min', '2.0');
    },
  },
  TURNAROUND: {
    title: 'Kernmuster A: Der Turnaround / Break-Even-Wendepunkt:',
    desc: 'Unternehmen am Übergang zu positivem EBITDA oder positivem operativem Cashflow (Operating Leverage) – erzwingt oft eine fundamentale Neubewertung.',
    apply: () => {
      resetFilterInputs();
      setChecked('chk-positive-cf', true);
    },
  },
  BINARY_CATALYST: {
    title: 'Kernmuster B: Binäre Katalysatoren (Biotech PDUFA & Rohstoffe/Mining):',
    desc: 'Biotech- (FDA Phase 2/3, PDUFA-Dates) und Explorations-/Mining-Werte (Bohrergebnisse, Feasibility Studies), bei denen ein einzelnes Event über den Unternehmenswert entscheidet.',
    apply: () => {
      resetFilterInputs();
    },
  },
  PURE_PLAY: {
    title: 'Kernmuster C: "Pure Play"-Thema in explosiven Hype-Sektoren:',
    desc: 'Kleine Profiteure in großen Makro-Trends: KI-Infrastruktur & Rechenzentren, Verteidigung/Drohnen/Aerospace sowie Energie, Festkörperbatterien & Power-Grid.',
    apply: () => {
      resetFilterInputs();
    },
  },
  SHORT_SQUEEZE: {
    title: 'Kernmuster D: Short Squeeze & Low-Float-Struktur:',
    desc: 'Hohe Short-Quote (Short Interest > 12–15 % des Floats) kombiniert mit knappem frei handelbarem Streubesitz (Low Float < 20 Mio. Aktien).',
    apply: () => {
      resetFilterInputs();
    },
  },
  SMART_MONEY: {
    title: 'Institutionelles Tracking: "Smart Money" (SEC Form 13D/13G & Form 4 Insider):',
    desc: 'Aktien mit aktuellen SEC Schedule 13D/13G Großinvestoren-Meldungen (> 5 % Anteil), positiven Form-4-Insiderkäufen oder hoher Vorstandsbeteiligung (> 15 %).',
    apply: () => {
      resetFilterInputs();
      setChecked('chk-smart-money', true);
    },
  },
  DILUTION_TRAP: {
    title: 'Forensischer Warn-Scanner: Enttarnte Verwässerungs- & Cash-Burn-Fallen:',
    desc: 'Zeigt zur Abschreckung und Short-/Forensik-Analyse jene Pennystocks mit kritischem Cash Runway (< 9 Monate) oder aktiven 424B5 / S-3 ATM-Verwässerungsprogrammen.',
    apply: () => {
      resetFilterInputs();
    },
  },
  WATCHLIST: {
    title: 'Deine persönliche Pennystock-Merkliste (Watchlist):',
    desc: 'Im Browser gespeicherte Favoriten für tägliches RVOL-, SEC-Filing- und Limit-Order-Tracking.',
    apply: () => {
      resetFilterInputs();
    },
  },
};

const SETUP_BADGE_MAP = {
  ENTRY_ALERT: { label: '🎯 ENTRY ≥ 80', cls: 'badge-green' },
  GOLDEN_POCKET: { label: '📐 Fib 0.618–0.786', cls: 'badge-amber' },
  BB_KC_SQUEEZE: { label: '🗜️ BB/KC Squeeze', cls: 'badge-cyan' },
  AVWAP_SUPPORT: { label: '⚓ AVWAP Support', cls: 'badge-blue' },
  SAFE_STANDARD: { label: 'Safe Standard', cls: 'badge-green' },
  REVENUE_ACCEL: { label: 'Sales Scaler', cls: 'badge-blue' },
  ACCUMULATION: { label: 'Akkumulation', cls: 'badge-cyan' },
  UNUSUAL_RVOL: { label: 'RVOL > 2.0', cls: 'badge-cyan' },
  TURNAROUND: { label: 'Turnaround', cls: 'badge-purple' },
  BINARY_CATALYST: { label: 'Biotech/Mining', cls: 'badge-amber' },
  PURE_PLAY: { label: 'Pure-Play Hype', cls: 'badge-blue' },
  SHORT_SQUEEZE: { label: 'Short Squeeze', cls: 'badge-red' },
  SMART_MONEY: { label: '13D/G • Insider', cls: 'badge-green' },
};

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initNavigation();
  initDialogFallbacks();
  initFilterListeners();
  initCalculatorListeners();
  initThemeToggle();
  await loadDataset();
});

async function loadDataset() {
  try {
    const resp = await fetch('data/pennystocks.json?v=20261101-v6', { cache: 'no-store' });
    const data = await resp.json();
    state.stocks = data.stocks || [];
    const ts = data.updatedAt ? new Date(data.updatedAt).toLocaleString('de-DE') : 'Aktuell';
    document.getElementById('dataset-timestamp').textContent = `Daten-Stand: ${ts} (${state.stocks.length} echte Börsenwerte)`;
    document.getElementById('live-status-text').textContent = `${state.stocks.length} LIVE MICRO-CAPS`;

    updateKpiStrip();
    populateTickerSelects();
    renderEntryRadar();
    renderSecRadar();
    applyFiltersAndRender();

    // Initialize calculators with top stock
    if (state.stocks.length > 0) {
      loadStockIntoEntryLab(state.stocks[0].ticker);
      loadStockIntoDdLab(state.stocks[0].ticker);
      loadStockIntoExecution(state.stocks[0].ticker);
    }
  } catch (err) {
    console.error('Fehler beim Laden des Datensatzes:', err);
    document.getElementById('results-summary-text').textContent = 'Fehler beim Laden der Daten.';
  }
}

// ============================================================================
// REAL-TIME BROWSER LIVE REFRESH (TradingView CORS Simple Request)
// ============================================================================
async function refreshLiveMarketData() {
  const btn = document.getElementById('btn-live-refresh');
  const label = document.getElementById('refresh-label');
  btn.disabled = true;
  label.textContent = 'Lade Echtzeit-Kurse...';

  const cols = [
    'name', 'close', 'change', 'volume', 'average_volume_90d_calc',
    'relative_volume_10d_calc', 'market_cap_basic', 'SMA50', 'SMA200', 'VWAP', 'RSI'
  ];

  const payloadUS = {
    filter: [
      { left: 'exchange', operation: 'in_range', right: ['NASDAQ', 'NYSE'] },
      { left: 'close', operation: 'in_range', right: [0.5, 5.0] },
      { left: 'market_cap_basic', operation: 'in_range', right: [15000000, 350000000] },
      { left: 'average_volume_90d_calc', operation: 'greater', right: 150000 },
      { left: 'type', operation: 'equal', right: 'stock' }
    ],
    columns: cols,
    sort: { sortBy: 'relative_volume_10d_calc', sortOrder: 'desc' },
    range: [0, 400]
  };

  try {
    // Using text/plain avoids CORS preflight and works directly from GitHub Pages & localhost
    const resp = await fetch('https://scanner.tradingview.com/america/scan', {
      method: 'POST',
      body: JSON.stringify(payloadUS)
    });
    const liveData = await resp.json();
    const map = new Map();
    for (const row of (liveData.data || [])) {
      const d = row.d;
      map.set(d[0], {
        price: d[1],
        change: d[2],
        volume: d[3],
        avgVolume: d[4],
        rvol: d[5],
        marketCap: d[6],
        sma50: d[7],
        sma200: d[8],
        vwap: d[9],
        rsi: d[10]
      });
    }

    let updatedCount = 0;
    for (const st of state.stocks) {
      const live = map.get(st.ticker);
      if (live && live.price != null) {
        st.price = Number(live.price.toFixed(live.price < 1 ? 4 : 2));
        if (live.change != null) st.change = Number(live.change.toFixed(2));
        if (live.volume != null) st.volume = Math.round(live.volume);
        if (live.avgVolume != null) st.avgVolume = Math.round(live.avgVolume);
        if (live.rvol != null) st.rvol = Number(live.rvol.toFixed(2));
        if (live.marketCap != null) {
          st.marketCap = Math.round(live.marketCap);
          st.marketCapM = Number((live.marketCap / 1e6).toFixed(2));
        }
        if (live.sma50 != null) st.sma50 = Number(live.sma50.toFixed(3));
        if (live.sma200 != null) st.sma200 = Number(live.sma200.toFixed(3));
        if (live.vwap != null) st.vwap = Number(live.vwap.toFixed(3));
        if (live.rsi != null) st.rsi = Number(live.rsi.toFixed(1));
        st.aboveSma50 = Boolean(st.sma50 && st.price >= st.sma50);
        st.aboveSma200 = Boolean(st.sma200 && st.price >= st.sma200);
        st.aboveVwap = Boolean(st.vwap && st.price >= st.vwap);
        updatedCount++;
      }
    }

    const nowStr = new Date().toLocaleTimeString('de-DE');
    document.getElementById('dataset-timestamp').textContent = `Echtzeit-Update: ${nowStr} (${updatedCount} Kurse live aktualisiert)`;
    label.textContent = `✓ ${updatedCount} Kurse live!`;
    updateKpiStrip();
    applyFiltersAndRender();
    setTimeout(() => { label.textContent = 'Live-Kurse aktualisieren'; }, 3500);
  } catch (e) {
    console.warn('Live-API Fallback auf gespeicherten Snapshot:', e);
    label.textContent = 'Snapshot aktiv';
    setTimeout(() => { label.textContent = 'Live-Kurse aktualisieren'; }, 2500);
  } finally {
    btn.disabled = false;
  }
}

// ============================================================================
// SPA VIEW TRANSITIONS (modern-web-guidance: faster-spa-view-transitions)
// ============================================================================
function switchToView(viewId) {
  document.querySelectorAll('.spa-view').forEach((view) => {
    view.classList.add('inactive');
    view.setAttribute('aria-hidden', 'true');
  });

  document.querySelectorAll('.nav-tab').forEach((tab) => {
    tab.setAttribute('aria-selected', tab.dataset.view === viewId ? 'true' : 'false');
  });

  const activeView = document.getElementById(viewId);
  if (activeView) {
    activeView.classList.remove('inactive');
    activeView.setAttribute('aria-hidden', 'false');
    // MANDATORY: Move focus to the new view to ensure a logical tab-order
    activeView.focus({ preventScroll: true });
  }
}

function initNavigation() {
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchToView(btn.dataset.view));
  });

  document.querySelectorAll('.kpi-card').forEach((card) => {
    const activate = () => {
      const preset = card.dataset.quickPreset;
      if (preset) {
        switchToView('view-screener');
        activatePreset(preset);
      }
    };
    card.addEventListener('click', activate);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        activate();
      }
    });
  });

  document.querySelectorAll('[data-jump-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.jumpPreset;
      switchToView('view-screener');
      activatePreset(preset);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  document.getElementById('btn-live-refresh').addEventListener('click', refreshLiveMarketData);
  document.getElementById('btn-export-csv').addEventListener('click', exportCurrentToCsv);
}

// ============================================================================
// KPI STRIP & FILTERING ENGINE
// ============================================================================
function isDilutionTrap(st) {
  return (
    (st.cashRunwayMonths != null && st.cashRunwayMonths < 9 && st.cashStatus !== 'positive') ||
    st.sec?.has424B ||
    (st.dilutionYoY != null && st.dilutionYoY > 22)
  );
}

function updateKpiStrip() {
  const entryCount = state.stocks.filter((s) => s.setups.includes('ENTRY_ALERT')).length;
  const safeCount = state.stocks.filter((s) => s.setups.includes('SAFE_STANDARD')).length;
  const rvolCount = state.stocks.filter((s) => s.rvol >= 2.0).length;
  const revCount = state.stocks.filter((s) => s.setups.includes('REVENUE_ACCEL')).length;
  const turnCount = state.stocks.filter((s) => s.setups.includes('TURNAROUND')).length;
  const smartCount = state.stocks.filter((s) => s.setups.includes('SMART_MONEY')).length;
  const trapCount = state.stocks.filter(isDilutionTrap).length;

  const kpiEntryEl = document.getElementById('kpi-entry-count');
  if (kpiEntryEl) kpiEntryEl.textContent = entryCount;
  const navEntryEl = document.getElementById('nav-count-entry');
  if (navEntryEl) navEntryEl.textContent = entryCount;

  document.getElementById('kpi-safe-count').textContent = safeCount;
  document.getElementById('kpi-rvol-count').textContent = rvolCount;
  document.getElementById('kpi-rev-count').textContent = revCount;
  document.getElementById('kpi-turnaround-count').textContent = turnCount;
  document.getElementById('kpi-smart-count').textContent = smartCount;
  document.getElementById('kpi-trap-count').textContent = trapCount;
  document.getElementById('watchlist-count').textContent = state.watchlist.size;
  document.getElementById('nav-count-sec').textContent = state.stocks.filter((s) => s.sec?.has13DG).length;
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = val;
}

function resetFilterInputs() {
  setVal('f-search', '');
  setVal('f-region', 'ALL');
  setVal('f-price-min', '');
  setVal('f-price-max', '');
  setVal('f-mcap-min', '');
  setVal('f-mcap-max', '');
  setVal('f-vol-min', '0');
  setVal('f-rvol-min', '0');
  setVal('f-runway-min', '0');
  setVal('f-float-max', '9999');
  setVal('f-insider-min', '0');
  setVal('f-short-min', '0');
  setVal('f-theme', 'ALL');
  setVal('f-score-min', '0');
  document.getElementById('f-score-val').textContent = '0';
  setChecked('chk-above-1usd', false);
  setChecked('chk-no-atm', false);
  setChecked('chk-above-sma', false);
  setChecked('chk-smart-money', false);
  setChecked('chk-positive-cf', false);
}

function activatePreset(presetKey) {
  state.activePreset = presetKey;
  document.querySelectorAll('.preset-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.preset === presetKey);
  });

  const def = PRESET_DEFINITIONS[presetKey] || PRESET_DEFINITIONS.ALL;
  document.getElementById('preset-banner-title').textContent = def.title;
  document.getElementById('preset-banner-text').textContent = def.desc;
  def.apply();
  applyFiltersAndRender();
}

function initFilterListeners() {
  document.querySelectorAll('.preset-pill').forEach((pill) => {
    pill.addEventListener('click', () => activatePreset(pill.dataset.preset));
  });

  document.getElementById('btn-reset-filters').addEventListener('click', () => activatePreset('ALL'));

  const filterIds = [
    'f-search', 'f-region', 'f-price-min', 'f-price-max', 'f-mcap-min', 'f-mcap-max',
    'f-vol-min', 'f-rvol-min', 'f-runway-min', 'f-float-max', 'f-insider-min',
    'f-short-min', 'f-theme', 'f-score-min', 'f-limit',
    'chk-above-1usd', 'chk-no-atm', 'chk-above-sma', 'chk-smart-money', 'chk-positive-cf'
  ];

  filterIds.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (id === 'f-score-min') {
        document.getElementById('f-score-val').textContent = el.value;
      }
      applyFiltersAndRender();
    });
    el.addEventListener('change', applyFiltersAndRender);
  });

  // Sortable table headers
  document.querySelectorAll('table.screener-table thead th[data-sort]').forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (state.sortField === field) {
        state.sortAsc = !state.sortAsc;
      } else {
        state.sortField = field;
        state.sortAsc = field === 'ticker';
      }
      applyFiltersAndRender();
    });
  });
}

function applyFiltersAndRender() {
  const q = (document.getElementById('f-search').value || '').trim().toLowerCase();
  const region = document.getElementById('f-region').value;
  const priceMin = parseFloat(document.getElementById('f-price-min').value);
  const priceMax = parseFloat(document.getElementById('f-price-max').value);
  const mcapMin = parseFloat(document.getElementById('f-mcap-min').value);
  const mcapMax = parseFloat(document.getElementById('f-mcap-max').value);
  const volMin = parseFloat(document.getElementById('f-vol-min').value) || 0;
  const rvolMin = parseFloat(document.getElementById('f-rvol-min').value) || 0;
  const runwayMin = parseFloat(document.getElementById('f-runway-min').value) || 0;
  const floatMax = parseFloat(document.getElementById('f-float-max').value) || 9999;
  const insiderMin = parseFloat(document.getElementById('f-insider-min').value) || 0;
  const shortMin = parseFloat(document.getElementById('f-short-min').value) || 0;
  const theme = document.getElementById('f-theme').value;
  const scoreMin = parseFloat(document.getElementById('f-score-min').value) || 0;

  const chkAbove1 = document.getElementById('chk-above-1usd').checked;
  const chkNoAtm = document.getElementById('chk-no-atm').checked;
  const chkAboveSma = document.getElementById('chk-above-sma').checked;
  const chkSmart = document.getElementById('chk-smart-money').checked;
  const chkPosCf = document.getElementById('chk-positive-cf').checked;

  state.filtered = state.stocks.filter((st) => {
    // Active preset special filters
    if (state.activePreset === 'WATCHLIST' && !state.watchlist.has(st.ticker)) return false;
    if (state.activePreset === 'DILUTION_TRAP' && !isDilutionTrap(st)) return false;
    if (
      [
        'ENTRY_ALERT', 'GOLDEN_POCKET', 'BB_KC_SQUEEZE', 'AVWAP_SUPPORT',
        'SAFE_STANDARD', 'REVENUE_ACCEL', 'ACCUMULATION', 'UNUSUAL_RVOL',
        'TURNAROUND', 'BINARY_CATALYST', 'PURE_PLAY', 'SHORT_SQUEEZE', 'SMART_MONEY'
      ].includes(state.activePreset) &&
      !st.setups.includes(state.activePreset)
    ) {
      return false;
    }

    if (q) {
      const hay = `${st.ticker} ${st.name} ${st.sector} ${st.industry} ${st.theme}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }

    if (region === 'US' && st.region !== 'US') return false;
    if (region === 'EU' && st.region !== 'EU') return false;
    if (region === 'NASDAQ' && st.exchange !== 'NASDAQ') return false;
    if (region === 'NYSE' && st.exchange !== 'NYSE') return false;

    if (!isNaN(priceMin) && st.price < priceMin) return false;
    if (!isNaN(priceMax) && st.price > priceMax) return false;
    if (!isNaN(mcapMin) && st.marketCapM < mcapMin) return false;
    if (!isNaN(mcapMax) && st.marketCapM > mcapMax) return false;

    if (st.avgVolume < volMin) return false;
    if (st.rvol < rvolMin) return false;

    if (runwayMin === 999) {
      if (st.cashStatus !== 'positive') return false;
    } else if (runwayMin > 0) {
      if ((st.cashRunwayMonths || 0) < runwayMin && st.cashStatus !== 'positive') return false;
    }

    if ((st.floatM || 999) > floatMax) return false;
    if ((st.insiderOwn || 0) < insiderMin) return false;
    if ((st.shortFloat || 0) < shortMin) return false;
    if (theme !== 'ALL' && st.theme !== theme) return false;
    if (st.scores.total < scoreMin) return false;

    if (chkAbove1 && st.price < 1.0) return false;
    if (chkNoAtm && st.sec?.has424B) return false;
    if (chkAboveSma && !(st.aboveSma50 && st.aboveSma200)) return false;
    if (chkSmart && !st.setups.includes('SMART_MONEY')) return false;
    if (chkPosCf && !((st.ebitdaQuarterlyM && st.ebitdaQuarterlyM > 0) || (st.ocfQuarterlyM && st.ocfQuarterlyM > 0))) return false;

    return true;
  });

  // Sort
  const sf = state.sortField;
  const dir = state.sortAsc ? 1 : -1;
  state.filtered.sort((a, b) => {
    let va = sf === 'score' ? a.scores.total : sf === 'confluenceScore' ? (a.entry?.confluenceScore ?? 0) : a[sf];
    let vb = sf === 'score' ? b.scores.total : sf === 'confluenceScore' ? (b.entry?.confluenceScore ?? 0) : b[sf];
    if (sf === 'revGrowthQoQ') {
      va = Math.max(a.revGrowthQoQ ?? -999, a.revGrowthYoY ?? -999);
      vb = Math.max(b.revGrowthQoQ ?? -999, b.revGrowthYoY ?? -999);
    }
    if (va == null) va = -999999;
    if (vb == null) vb = -999999;
    if (typeof va === 'string') return va.localeCompare(vb) * dir;
    return (va - vb) * dir;
  });

  document.getElementById('nav-count-screener').textContent = state.filtered.length;
  renderScreenerTable();
}

// ============================================================================
// RENDER SCREENER TABLE
// ============================================================================
function renderScreenerTable() {
  const tbody = document.getElementById('screener-tbody');
  const limit = parseInt(document.getElementById('f-limit').value, 10) || 100;
  const slice = state.filtered.slice(0, limit);

  document.getElementById('results-summary-text').innerHTML =
    `Zeige <strong>${slice.length}</strong> von <strong>${state.filtered.length}</strong> passenden Pennystocks (Gesamt-Universum: ${state.stocks.length}) • <em>Klicke auf einen Ticker für Live-Chart, SEC-Filings &amp; 4-Säulen-Scorecard</em>`;

  if (slice.length === 0) {
    tbody.innerHTML = `
      <tr>
        <th scope="row">Keine Treffer</th>
        <td colspan="10" style="text-align:center;padding:2rem;color:var(--text-secondary);">
          Keine Aktien erfüllen aktuell diese Filterkombination. Klicke auf <strong>Filter zurücksetzen</strong> oder lockere einzelne Kriterien.
        </td>
      </tr>`;
    return;
  }

  const rowsHtml = slice.map((st) => {
    const cur = st.currency === 'EUR' ? '€' : '$';
    const isStarred = state.watchlist.has(st.ticker);
    const sc = st.scores.total;
    const scoreClass = sc >= 72 ? 'score-high' : sc >= 52 ? 'score-mid' : 'score-low';

    // Cash Runway badge
    let runwayBadge = '';
    if (st.cashStatus === 'positive') {
      runwayBadge = `<span class="badge badge-green">CF POSITIV</span>`;
    } else if (st.cashRunwayMonths >= 12) {
      runwayBadge = `<span class="badge badge-green">${st.cashRunwayMonths} Mon.</span>`;
    } else if (st.cashRunwayMonths >= 9) {
      runwayBadge = `<span class="badge badge-amber">${st.cashRunwayMonths} Mon.</span>`;
    } else {
      runwayBadge = `<span class="badge badge-red">⚠ ${st.cashRunwayMonths} Mon.</span>`;
    }
    const cashSub = st.cashM != null ? `Cash: ${st.cashM}M ${cur}` : `Curr.Ratio: ${st.currentRatio ?? '—'}`;

    // Dilution & SEC badges
    const dilVal = st.dilutionYoY != null ? `${st.dilutionYoY > 0 ? '+' : ''}${st.dilutionYoY}%` : '—';
    const dilCls = st.dilutionYoY > 18 ? 'neg' : st.dilutionYoY <= 5 ? 'pos' : '';
    let secBadges = '';
    if (st.sec?.has13DG) {
      secBadges += `<span class="badge badge-green" title="SEC Schedule 13D/13G Großinvestor (>5%)">13D/G</span> `;
    }
    if (st.sec?.has424B) {
      secBadges += `<span class="badge badge-red" title="Aktives Form 424B Prospekt / ATM-Verwässerung">424B ATM</span> `;
    } else if (st.sec?.hasS3) {
      secBadges += `<span class="badge badge-amber" title="Offene Form S-3 Shelf Registration">S-3</span> `;
    }
    if (!secBadges) {
      secBadges = `<span class="badge badge-blue">SEC Clean</span>`;
    }

    // Float badge
    const floatBadge = st.floatM <= 15
      ? `<span class="badge badge-purple" title="Low Float (<15M Aktien)">LOW ${st.floatM}M</span>`
      : `<span class="mono">${st.floatM}M</span>`;

    // Growth & EBITDA
    const bestRev = st.revGrowthQoQ ?? st.revGrowthYoY;
    const revStr = bestRev != null ? `${bestRev > 0 ? '+' : ''}${bestRev}%` : '—';
    const revCls = bestRev >= 25 ? 'pos' : bestRev < 0 ? 'neg' : '';
    const ebitdaStr = st.ebitdaQuarterlyM != null
      ? `EBITDA: ${st.ebitdaQuarterlyM > 0 ? '+' : ''}${st.ebitdaQuarterlyM}M`
      : `D/E: ${st.debtToEquity}`;

    // Entry-Zone & Confluence (Column 10)
    const en = st.entry || {};
    const confScore = en.confluenceScore ?? 50;
    const confBadge = confScore >= 80
      ? `<span class="badge badge-green" title="High-Confluence Entry Alert (≥80 Punkte)">🎯 ${confScore}/100 ALERT</span>`
      : confScore >= 60
        ? `<span class="badge badge-amber">${confScore}/100 Conf.</span>`
        : `<span class="badge badge-blue">${confScore}/100 Conf.</span>`;
    const zoneStr = en.optEntryLow != null && en.optEntryHigh != null
      ? `Zone: <strong>${en.optEntryLow}–${en.optEntryHigh}${cur}</strong>`
      : `VWAP: ${st.vwap ?? '—'}`;
    const stopStr = en.optStop != null
      ? `Stop: <span class="neg">${en.optStop}${cur}</span> • ${en.isSqueeze ? '🗜️ Squeeze' : en.inGoldenPocket ? '📐 Fib 61.8' : 'AVWAP'}`
      : `RSI: ${st.rsi ?? '—'}`;

    // Setups
    const setupTags = st.setups
      .filter((s) => SETUP_BADGE_MAP[s])
      .slice(0, 3)
      .map((s) => `<span class="badge ${SETUP_BADGE_MAP[s].cls}">${SETUP_BADGE_MAP[s].label}</span>`)
      .join('');

    return `
      <tr data-ticker="${st.ticker}">
        <th scope="row">
          <div class="ticker-cell">
            <button type="button" class="star-btn ${isStarred ? 'starred' : ''}" data-star="${st.ticker}" aria-label="Auf Merkliste setzen">
              ${isStarred ? '★' : '☆'}
            </button>
            <div>
              <div style="display:flex;align-items:center;gap:0.35rem;">
                <span class="ticker-symbol" data-open-ticker="${st.ticker}">${st.ticker}</span>
                <span class="exch-badge">${st.exchange}</span>
                ${st.price < 1.0 && st.region === 'US' ? '<span class="badge badge-red" title="Kurs unter 1,00 $ – Delisting-Gefahr">&lt;1$</span>' : ''}
              </div>
              <span class="company-sub" title="${escapeHtml(st.name)} • ${escapeHtml(st.theme)}">${escapeHtml(st.name)}</span>
            </div>
          </div>
        </th>

        <td>
          <div class="score-pill ${scoreClass}">${sc} / 100</div>
          <div class="pillar-mini-bars" title="Säule A (${st.scores.cashDilution}/30) • B (${st.scores.floatOwnership}/25) • C (${st.scores.catalystGrowth}/25) • D (${st.scores.technicals}/20)">
            <span class="pillar-dot" style="background:${st.scores.cashDilution >= 20 ? 'var(--accent-primary)' : 'var(--accent-amber)'}"></span>
            <span class="pillar-dot" style="background:${st.scores.floatOwnership >= 15 ? 'var(--accent-primary)' : 'var(--accent-amber)'}"></span>
            <span class="pillar-dot" style="background:${st.scores.catalystGrowth >= 14 ? 'var(--accent-primary)' : 'var(--accent-amber)'}"></span>
            <span class="pillar-dot" style="background:${st.scores.technicals >= 12 ? 'var(--accent-primary)' : 'var(--accent-amber)'}"></span>
          </div>
        </td>

        <td class="mono">
          <div style="font-weight:700;">${st.price} ${cur}</div>
          <div class="${st.change >= 0 ? 'pos' : 'neg'}" style="font-size:0.75rem;">
            ${st.change >= 0 ? '+' : ''}${st.change}%
          </div>
        </td>

        <td class="mono">
          <div>
            <span class="badge ${st.rvol >= 2.0 ? 'badge-cyan' : 'badge-blue'}">${st.rvol}x RVOL</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">
            Ø ${(st.avgVolume / 1e3).toFixed(0)}k
          </div>
        </td>

        <td class="mono">
          <div style="font-weight:700;">${st.marketCapM}M ${cur}</div>
          <div style="font-size:0.72rem;color:var(--text-secondary);">Float: ${floatBadge}</div>
        </td>

        <td>
          <div>${runwayBadge}</div>
          <div class="mono" style="font-size:0.71rem;color:var(--text-muted);margin-top:2px;">${cashSub}</div>
        </td>

        <td>
          <div>${secBadges}</div>
          <div class="mono ${dilCls}" style="font-size:0.72rem;margin-top:2px;">Shares YoY: ${dilVal}</div>
        </td>

        <td class="mono">
          <div>Ins: <strong>${st.insiderOwn}%</strong> <span class="${st.insiderTrans > 0 ? 'pos' : st.insiderTrans < 0 ? 'neg' : ''}">(${st.insiderTrans > 0 ? '+' : ''}${st.insiderTrans}%)</span></div>
          <div style="font-size:0.72rem;color:var(--text-secondary);">Short: <strong class="${st.shortFloat >= 15 ? 'warn' : ''}">${st.shortFloat}%</strong></div>
        </td>

        <td class="mono">
          <div>Sales: <strong class="${revCls}">${revStr}</strong></div>
          <div style="font-size:0.72rem;color:var(--text-secondary);">${ebitdaStr}</div>
        </td>

        <td>
          <div>${confBadge}</div>
          <div class="mono" style="font-size:0.72rem;color:var(--text-secondary);margin-top:2px;">${zoneStr}</div>
          <div class="mono" style="font-size:0.71rem;color:var(--text-muted);">${stopStr}</div>
        </td>

        <td>
          <div class="setup-tags-wrap">${setupTags}</div>
          <button type="button" class="btn btn-sm" style="margin-top:0.35rem;" data-open-ticker="${st.ticker}">
            🔍 Forensik &amp; Chart
          </button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rowsHtml;

  // Bind star and modal open events
  tbody.querySelectorAll('[data-star]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWatchlist(btn.dataset.star);
    });
  });

  tbody.querySelectorAll('[data-open-ticker]').forEach((el) => {
    el.addEventListener('click', () => openStockDialog(el.dataset.openTicker));
  });
}

function toggleWatchlist(ticker) {
  if (state.watchlist.has(ticker)) {
    state.watchlist.delete(ticker);
  } else {
    state.watchlist.add(ticker);
  }
  localStorage.setItem('alphaPennyWatchlist', JSON.stringify([...state.watchlist]));
  updateKpiStrip();
  applyFiltersAndRender();
}

// ============================================================================
// VIEW 1B: ALGORITHMIC ENTRY-ZONE & 100-POINT CONFLUENCE RADAR
// ============================================================================
function renderEntryRadar() {
  // 1. Top High-Confluence Entry Alerts (Score >= 80)
  const listAlerts = state.stocks
    .filter((s) => (s.entry?.confluenceScore || 0) >= 80)
    .sort((a, b) => (b.entry.confluenceScore * 2 + b.scores.total) - (a.entry.confluenceScore * 2 + a.scores.total))
    .slice(0, 14);

  const alertsEl = document.getElementById('radar-entry-alerts-list');
  if (alertsEl) {
    alertsEl.innerHTML = listAlerts.map((s) => {
      const cur = s.currency === 'EUR' ? '€' : '$';
      const en = s.entry;
      return `
        <div class="result-box" style="padding:0.65rem 0.8rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <div>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <strong class="mono ticker-symbol" data-entry-open="${s.ticker}">${s.ticker}</strong>
              <span class="badge badge-green">🎯 ${en.confluenceScore}/100</span>
              <span class="mono" style="font-size:0.75rem;font-weight:700;">${s.price}${cur}</span>
            </div>
            <div class="mono" style="font-size:0.73rem;color:var(--text-secondary);margin-top:2px;">
              Zone: <strong>${en.optEntryLow}–${en.optEntryHigh}${cur}</strong> • Stop: <span class="neg">${en.optStop}${cur}</span>
            </div>
          </div>
          <div style="display:flex;gap:0.35rem;">
            <button type="button" class="btn btn-sm" data-entry-calc="${s.ticker}" title="In Formel-Rechner laden">Rechner</button>
            <button type="button" class="btn btn-sm" data-entry-open="${s.ticker}">Chart</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 2. Golden Pocket Retests (0.618 - 0.786 Fib Zone)
  const listGolden = state.stocks
    .filter((s) => s.setups.includes('GOLDEN_POCKET'))
    .sort((a, b) => (b.entry?.confluenceScore || 0) - (a.entry?.confluenceScore || 0))
    .slice(0, 14);

  const goldenEl = document.getElementById('radar-golden-pocket-list');
  if (goldenEl) {
    goldenEl.innerHTML = listGolden.map((s) => {
      const cur = s.currency === 'EUR' ? '€' : '$';
      const en = s.entry;
      return `
        <div class="result-box" style="padding:0.65rem 0.8rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <div>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <strong class="mono ticker-symbol" data-entry-open="${s.ticker}">${s.ticker}</strong>
              <span class="badge badge-amber">Fib 0.618–0.786</span>
              <span class="mono" style="font-size:0.75rem;">Kurs: ${s.price}${cur}</span>
            </div>
            <div class="mono" style="font-size:0.73rem;color:var(--text-secondary);margin-top:2px;">
              Pocket: <strong>${en.fib786}–${en.fib618}${cur}</strong> • 0.886-Stop: <span class="neg">${en.fib886Stop}${cur}</span>
            </div>
          </div>
          <div style="display:flex;gap:0.35rem;">
            <button type="button" class="btn btn-sm" data-entry-calc="${s.ticker}">Rechner</button>
            <button type="button" class="btn btn-sm" data-entry-open="${s.ticker}">Chart</button>
          </div>
        </div>
      `;
    }).join('');
  }

  // 3. Bollinger / Keltner Volatility Squeeze (BB inside KC)
  const listSqueeze = state.stocks
    .filter((s) => s.setups.includes('BB_KC_SQUEEZE'))
    .sort((a, b) => (b.entry?.confluenceScore || 0) - (a.entry?.confluenceScore || 0))
    .slice(0, 14);

  const squeezeEl = document.getElementById('radar-squeeze-list');
  if (squeezeEl) {
    squeezeEl.innerHTML = listSqueeze.map((s) => {
      const cur = s.currency === 'EUR' ? '€' : '$';
      const en = s.entry;
      return `
        <div class="result-box" style="padding:0.65rem 0.8rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
          <div>
            <div style="display:flex;align-items:center;gap:0.4rem;">
              <strong class="mono ticker-symbol" data-entry-open="${s.ticker}">${s.ticker}</strong>
              <span class="badge badge-cyan">${en.squeezeTrigger ? '🔥 Trigger Aktiv' : '🗜️ Squeeze On'}</span>
              <span class="mono" style="font-size:0.75rem;">${s.price}${cur}</span>
            </div>
            <div class="mono" style="font-size:0.73rem;color:var(--text-secondary);margin-top:2px;">
              SMA20: <strong>${s.sma20 ?? s.price}${cur}</strong> • KC-Stop: <span class="neg">${en.optStop}${cur}</span> • Conf: ${en.confluenceScore}
            </div>
          </div>
          <div style="display:flex;gap:0.35rem;">
            <button type="button" class="btn btn-sm" data-entry-calc="${s.ticker}">Rechner</button>
            <button type="button" class="btn btn-sm" data-entry-open="${s.ticker}">Chart</button>
          </div>
        </div>
      `;
    }).join('');
  }

  document.querySelectorAll('[data-entry-open]').forEach((el) => {
    el.addEventListener('click', () => openStockDialog(el.dataset.entryOpen));
  });
  document.querySelectorAll('[data-entry-calc]').forEach((el) => {
    el.addEventListener('click', () => {
      loadStockIntoEntryLab(el.dataset.entryCalc);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

function loadStockIntoEntryLab(ticker) {
  const st = state.stocks.find((s) => s.ticker === ticker);
  if (!st) return;

  const sel = document.getElementById('entry-ticker-select');
  if (sel) sel.value = st.ticker;
  const badge = document.getElementById('entry-lab-ticker-badge');
  if (badge) badge.textContent = `${st.ticker} (${st.exchange} • ${st.price} ${st.currency === 'EUR' ? '€' : '$'})`;

  const en = st.entry || {};
  setVal('en-price', st.price);
  setVal('en-plow', en.swingLow ?? Number((st.price * 0.72).toFixed(3)));
  setVal('en-phigh', en.swingHigh ?? Number((st.price * 1.35).toFixed(3)));
  setVal('en-vwap', st.vwap ?? en.avwapAnchor ?? st.price);
  setVal('en-sma20', st.sma20 ?? st.price);
  setVal('en-sma200', st.sma200 ?? Number((st.price * 0.88).toFixed(3)));
  setVal('en-bb-upper', st.bbUpper ?? Number((st.price * 1.12).toFixed(3)));
  setVal('en-bb-lower', st.bbLower ?? Number((st.price * 0.88).toFixed(3)));
  setVal('en-atr', st.atr ?? Number((st.price * 0.08).toFixed(3)));
  setVal('en-vol-ratio', en.pullbackVolRatio ?? 44);
  setVal('en-spread', en.estSpreadPct ?? 0.65);

  calculateEntryLab();
}

function calculateEntryLab() {
  const price = parseFloat(document.getElementById('en-price')?.value) || 2.5;
  const pLow = parseFloat(document.getElementById('en-plow')?.value) || 1.8;
  const pHigh = parseFloat(document.getElementById('en-phigh')?.value) || 3.4;
  const vwap = parseFloat(document.getElementById('en-vwap')?.value) || price;
  const sma20 = parseFloat(document.getElementById('en-sma20')?.value) || price;
  const sma200 = parseFloat(document.getElementById('en-sma200')?.value) || price * 0.9;
  const bbUpper = parseFloat(document.getElementById('en-bb-upper')?.value) || price * 1.1;
  const bbLower = parseFloat(document.getElementById('en-bb-lower')?.value) || price * 0.9;
  const atr = parseFloat(document.getElementById('en-atr')?.value) || price * 0.07;
  const volRatio = parseFloat(document.getElementById('en-vol-ratio')?.value) || 45;
  const spreadPct = parseFloat(document.getElementById('en-spread')?.value) || 0.8;

  const dec = price < 1.0 ? 4 : 3;

  // 1. Golden Pocket Formula (0.618 - 0.786 Retest + 0.886 Stop)
  const swingRange = Math.max(0.01, pHigh - pLow);
  const fib618 = Number((pHigh - 0.618 * swingRange).toFixed(dec));
  const fib786 = Number((pHigh - 0.786 * swingRange).toFixed(dec));
  const fib886Stop = Number((pHigh - 0.886 * swingRange).toFixed(dec));
  const inGoldenPocket = price >= fib786 * 0.96 && price <= fib618 * 1.04;

  // 2. Volume Profile & Anchor-VWAP Model (AVWAP & Value Area High VAH)
  const avwapBandLow = Number(Math.max(0.01, vwap - 0.5 * atr).toFixed(dec));
  const vpoc = Number(((vwap * 0.6) + (sma20 * 0.4)).toFixed(dec));
  const vah = Number((vpoc + 0.35 * atr).toFixed(dec));
  const inAvwapZone = (price >= avwapBandLow * 0.98 && price <= vwap * 1.04) || (price >= vpoc && price <= vah * 1.03);

  // 3. Bollinger / Keltner Volatility Squeeze
  const kcUpper = Number((sma20 + 1.5 * atr).toFixed(dec));
  const kcLower = Number(Math.max(0.01, sma20 - 1.5 * atr).toFixed(dec));
  const isSqueeze = bbUpper < kcUpper && bbLower > kcLower;
  const squeezeTrigger = isSqueeze && price >= sma20;

  // 4. 100-Point Confluence Scoring
  // Criterion 1: Trend / Structure (25 pts)
  let ptsTrend = 0;
  if (price >= sma200 && price > pLow) ptsTrend = 25;
  else if (price > pLow * 1.05 || price >= sma20) ptsTrend = 18;
  else ptsTrend = 8;

  // Criterion 2: Liquidity Zone (30 pts)
  let ptsZone = 0;
  if (inGoldenPocket && inAvwapZone) ptsZone = 30;
  else if (inGoldenPocket || inAvwapZone || squeezeTrigger) ptsZone = 26;
  else if (isSqueeze) ptsZone = 22;
  else ptsZone = 10;

  // Criterion 3: Volume Dry-Up in Pullback (25 pts)
  let ptsVol = 0;
  if (volRatio <= 50) ptsVol = 25;
  else if (volRatio <= 68) ptsVol = 18;
  else ptsVol = 9;

  // Criterion 4: Orderbook / Spread < 1.5% (20 pts)
  let ptsSpread = 0;
  if (spreadPct < 1.0) ptsSpread = 20;
  else if (spreadPct <= 1.5) ptsSpread = 16;
  else if (spreadPct <= 2.5) ptsSpread = 8;
  else ptsSpread = 0;

  const totalConf = Math.min(100, ptsTrend + ptsZone + ptsVol + ptsSpread);
  const isAlert = totalConf >= 80;
  const pillCls = totalConf >= 80 ? 'score-high' : totalConf >= 60 ? 'score-mid' : 'score-low';

  // Recommended Optimal Entry & Stop for CRV transfer
  const optEntryLow = isSqueeze ? Number((sma20 * 0.99).toFixed(dec)) : fib786;
  const optEntryHigh = isSqueeze ? Number((sma20 * 1.02).toFixed(dec)) : fib618;
  const optStop = isSqueeze ? kcLower : fib886Stop;
  const estRisk = Math.max(0.01, optEntryHigh - optStop);
  const estReward = Math.max(0.02, pHigh - optEntryHigh);
  const estCrv = (estReward / estRisk).toFixed(1);

  const outEl = document.getElementById('entry-lab-output');
  if (!outEl) return;

  outEl.innerHTML = `
    <h3>
      <span>🎯 Berechnete Entry-Zonen &amp; Confluence-Score</span>
      <span class="score-pill ${pillCls}">${totalConf} / 100 ${isAlert ? '• ENTRY ALERT!' : 'Punkte'}</span>
    </h3>

    <div class="grid-3" style="margin-block-end:0.85rem;">
      <div class="result-box">
        <div style="font-size:0.72rem;color:var(--text-secondary);">1. Golden Pocket (61.8% – 78.6%)</div>
        <div class="mono" style="font-size:1.15rem;font-weight:800;color:var(--accent-amber);">${fib786} – ${fib618} $</div>
        <div class="mono" style="font-size:0.73rem;color:var(--text-muted);">
          0.886 Stop: <strong class="neg">${fib886Stop} $</strong> ${inGoldenPocket ? '• <span class="pos">✓ IM POCKET</span>' : ''}
        </div>
      </div>

      <div class="result-box">
        <div style="font-size:0.72rem;color:var(--text-secondary);">2. AVWAP &amp; Volume Profile (VAH)</div>
        <div class="mono" style="font-size:1.15rem;font-weight:800;color:var(--accent-cyan);">${avwapBandLow} – ${vwap.toFixed(dec)} $</div>
        <div class="mono" style="font-size:0.73rem;color:var(--text-muted);">
          VPOC: ${vpoc} $ • VAH: ${vah} $ ${inAvwapZone ? '• <span class="pos">✓ SUPPORT</span>' : ''}
        </div>
      </div>

      <div class="result-box">
        <div style="font-size:0.72rem;color:var(--text-secondary);">3. BB / Keltner Squeeze-Check</div>
        <div class="mono" style="font-size:1.1rem;font-weight:800;color:${isSqueeze ? 'var(--accent-primary)' : 'var(--text-secondary)'};">
          ${isSqueeze ? '🗜️ SQUEEZE ON (Aktiv)' : 'Kein Squeeze (Expansion)'}
        </div>
        <div class="mono" style="font-size:0.73rem;color:var(--text-muted);">
          KC: ${kcLower}–${kcUpper} $ • CRV zum Peak: <strong>${estCrv}:1</strong>
        </div>
      </div>
    </div>

    <div class="result-box" style="display:flex;flex-direction:column;gap:0.45rem;font-size:0.81rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>1. Trend / Struktur (Close &gt; SMA 200 oder Higher Low):</strong>
        <span class="badge ${ptsTrend >= 20 ? 'badge-green' : 'badge-amber'}">${ptsTrend} / 25 Pkt.</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>2. Liquiditätszone (Golden Pocket 0.618–0.786 / AVWAP / Squeeze):</strong>
        <span class="badge ${ptsZone >= 25 ? 'badge-green' : 'badge-amber'}">${ptsZone} / 30 Pkt.</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>3. Volumendynamik (Pullback-Volumen ${volRatio}% &lt; 50% Spike = Volume Dry-Up):</strong>
        <span class="badge ${ptsVol >= 20 ? 'badge-green' : 'badge-amber'}">${ptsVol} / 25 Pkt.</span>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <strong>4. Orderbuch / Spread (${spreadPct}% &lt; 1,5% vom Aktienkurs):</strong>
        <span class="badge ${ptsSpread >= 16 ? 'badge-green' : 'badge-red'}">${ptsSpread} / 20 Pkt.</span>
      </div>
      <div style="border-top:1px solid var(--border-subtle);padding-top:0.45rem;margin-top:0.15rem;display:flex;justify-content:space-between;align-items:center;">
        <span><strong>Empfohlene Limit-Entry-Zone:</strong> <code class="mono">${optEntryLow} – ${optEntryHigh} $</code> (Invalidation Stop @ <code class="mono neg">${optStop} $</code>)</span>
        <span class="badge ${isAlert ? 'badge-green' : 'badge-blue'}">${isAlert ? '✓ SIGNAL ≥ 80 ERFÜLLT' : 'Warte auf Retest in Zone'}</span>
      </div>
    </div>
  `;

  outEl.dataset.optEntry = String(optEntryHigh);
  outEl.dataset.optStop = String(optStop);
  outEl.dataset.optTarget1 = String(Number(pHigh.toFixed(2)));
  outEl.dataset.optTarget2 = String(Number((pHigh + swingRange * 0.618).toFixed(2)));
}

// ============================================================================
// VIEW 2: SEC EDGAR & SMART MONEY RADAR
// ============================================================================
function renderSecRadar() {
  // 1. 13D / 13G Institutional filings
  const list13dg = state.stocks
    .filter((s) => s.sec?.has13DG && s.sec?.latest13DG)
    .sort((a, b) => (b.sec.latest13DG.date || '').localeCompare(a.sec.latest13DG.date || ''))
    .slice(0, 14);

  document.getElementById('sec-13dg-list').innerHTML = list13dg.map((s) => `
    <div class="result-box" style="padding:0.65rem 0.8rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
      <div>
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <strong class="mono ticker-symbol" data-radar-open="${s.ticker}">${s.ticker}</strong>
          <span class="badge badge-green">${s.sec.latest13DG.form}</span>
          <span class="mono" style="font-size:0.72rem;color:var(--text-muted);">${s.sec.latest13DG.date}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-secondary);">
          Kurs: ${s.price}$ • Inst. Own: <strong>${s.instOwn}%</strong> • Score: ${s.scores.total}/100
        </div>
      </div>
      <div style="display:flex;gap:0.35rem;">
        <a href="${s.sec.latest13DG.url}" target="_blank" rel="noopener" class="btn btn-sm" title="Original SEC Filing öffnen">SEC ↗</a>
        <button type="button" class="btn btn-sm" data-radar-open="${s.ticker}">Dossier</button>
      </div>
    </div>
  `).join('');

  // 2. Insider buying & high skin-in-the-game
  const listInsider = state.stocks
    .filter((s) => s.insiderTrans > 0 || s.insiderOwn >= 20)
    .sort((a, b) => (b.insiderTrans * 3 + b.insiderOwn) - (a.insiderTrans * 3 + a.insiderOwn))
    .slice(0, 14);

  document.getElementById('sec-insider-list').innerHTML = listInsider.map((s) => `
    <div class="result-box" style="padding:0.65rem 0.8rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
      <div>
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <strong class="mono ticker-symbol" data-radar-open="${s.ticker}">${s.ticker}</strong>
          <span class="badge badge-amber">Insider: ${s.insiderOwn}%</span>
          ${s.insiderTrans > 0 ? `<span class="badge badge-green">+${s.insiderTrans}% Käufe</span>` : ''}
        </div>
        <div style="font-size:0.75rem;color:var(--text-secondary);">
          Float: ${s.floatM}M • Form 4 Filings: ${s.sec?.form4Count || 0} • Score: ${s.scores.total}/100
        </div>
      </div>
      <div style="display:flex;gap:0.35rem;">
        <a href="http://openinsider.com/search?q=${s.ticker}" target="_blank" rel="noopener" class="btn btn-sm">Form 4 ↗</a>
        <button type="button" class="btn btn-sm" data-radar-open="${s.ticker}">Dossier</button>
      </div>
    </div>
  `).join('');

  // 3. Dilution Traps (424B5 / S-3 + Low Cash Runway)
  const listDilution = state.stocks
    .filter((s) => s.sec?.has424B || (s.sec?.hasS3 && (s.cashRunwayMonths || 99) < 12))
    .sort((a, b) => (a.cashRunwayMonths || 99) - (b.cashRunwayMonths || 99))
    .slice(0, 14);

  document.getElementById('sec-dilution-list').innerHTML = listDilution.map((s) => `
    <div class="result-box" style="padding:0.65rem 0.8rem;display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
      <div>
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <strong class="mono ticker-symbol" data-radar-open="${s.ticker}">${s.ticker}</strong>
          <span class="badge badge-red">${s.sec.latestDilution?.form || 'S-3'}</span>
          <span class="badge badge-amber">Runway: ${s.cashRunwayMonths}M</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-secondary);">
          Filing: ${s.sec.latestDilution?.date || 'Aktiv'} • Dilution YoY: +${s.dilutionYoY}%
        </div>
      </div>
      <div style="display:flex;gap:0.35rem;">
        ${s.sec.latestDilution?.url ? `<a href="${s.sec.latestDilution.url}" target="_blank" rel="noopener" class="btn btn-sm">Filing ↗</a>` : ''}
        <button type="button" class="btn btn-sm" data-radar-open="${s.ticker}">Prüfen</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('[data-radar-open]').forEach((el) => {
    el.addEventListener('click', () => openStockDialog(el.dataset.radarOpen));
  });
}

// ============================================================================
// VIEW 3: 4-PILLAR DUE DILIGENCE LAB & SIMULATOR
// ============================================================================
function populateTickerSelects() {
  const sorted = [...state.stocks].sort((a, b) => a.ticker.localeCompare(b.ticker));
  const opts = sorted.map((s) => `<option value="${s.ticker}">${s.ticker} – ${escapeHtml(s.name.slice(0, 28))} (${s.price} ${s.currency === 'EUR' ? '€' : '$'})</option>`).join('');
  const entrySel = document.getElementById('entry-ticker-select');
  if (entrySel) entrySel.innerHTML = opts;
  document.getElementById('dd-ticker-select').innerHTML = opts;
  document.getElementById('exec-ticker-select').innerHTML = opts;
}

function loadStockIntoDdLab(ticker) {
  const st = state.stocks.find((s) => s.ticker === ticker);
  if (!st) return;

  document.getElementById('dd-ticker-select').value = st.ticker;
  document.getElementById('dd-current-ticker-badge').textContent = `${st.ticker} (${st.exchange})`;

  setVal('dd-cash', st.cashM != null ? st.cashM : Number((st.marketCapM * 0.18).toFixed(1)));
  setVal('dd-burn', st.ocfQuarterlyM != null ? st.ocfQuarterlyM : -3.2);

  const prevSh = st.sharesHistory?.['2024'] || st.sharesHistory?.['2023'] || (st.sharesOutM ? Number((st.sharesOutM / (1 + (st.dilutionYoY || 8) / 100)).toFixed(2)) : 25);
  setVal('dd-shares-prev', prevSh);
  setVal('dd-shares-now', st.sharesOutM || 28);
  setVal('dd-float', st.floatM || 18);
  setVal('dd-insider', st.insiderOwn || 10);
  setVal('dd-short', st.shortFloat || 5);
  setVal('dd-debt-eq', st.debtToEquity ?? 0.2);

  if (st.sec?.has424B) {
    setVal('dd-filing-status', 'atm');
  } else if (st.sec?.hasS3) {
    setVal('dd-filing-status', 's3');
  } else {
    setVal('dd-filing-status', 'clean');
  }

  if (st.setups.includes('TURNAROUND')) {
    setVal('dd-catalyst-type', 'turnaround');
  } else if (st.setups.includes('BINARY_CATALYST')) {
    setVal('dd-catalyst-type', 'pdufa');
  } else {
    setVal('dd-catalyst-type', 'pureplay');
  }

  if (st.aboveSma50 && st.aboveSma200) {
    setVal('dd-tech-status', 'strong');
  } else if (st.aboveSma50 || st.aboveSma200) {
    setVal('dd-tech-status', 'base');
  } else {
    setVal('dd-tech-status', 'downtrend');
  }

  calculateDdLab();
}

function calculateDdLab() {
  const cash = parseFloat(document.getElementById('dd-cash').value) || 0;
  const burnQ = parseFloat(document.getElementById('dd-burn').value) || 0;
  const shPrev = parseFloat(document.getElementById('dd-shares-prev').value) || 1;
  const shNow = parseFloat(document.getElementById('dd-shares-now').value) || 1;
  const floatM = parseFloat(document.getElementById('dd-float').value) || 20;
  const insider = parseFloat(document.getElementById('dd-insider').value) || 0;
  const shortPct = parseFloat(document.getElementById('dd-short').value) || 0;
  const debtEq = parseFloat(document.getElementById('dd-debt-eq').value) || 0;
  const filingStatus = document.getElementById('dd-filing-status').value;
  const catalystType = document.getElementById('dd-catalyst-type').value;
  const techStatus = document.getElementById('dd-tech-status').value;

  const checkedBoxes = document.querySelectorAll('.dd-chk:checked').length;

  // 1. Cash Runway
  let runwayMonths = 36;
  let runwayText = 'Cashflow-Positiv (Kein operativer Cash-Burn!)';
  let runwayBadge = 'badge-green';
  if (burnQ < 0) {
    const monthlyBurn = Math.abs(burnQ) / 3.0;
    runwayMonths = Number((cash / monthlyBurn).toFixed(1));
    if (runwayMonths < 9) {
      runwayText = `KRITISCH: Nur ${runwayMonths} Monate Runway (< 9M = Akute Notkapitalerhöhung!)`;
      runwayBadge = 'badge-red';
    } else if (runwayMonths < 12) {
      runwayText = `WARNUNG: ${runwayMonths} Monate Runway (9–12M Gelbzone – S-3/ATM genau beobachten)`;
      runwayBadge = 'badge-amber';
    } else {
      runwayText = `SOLIDE: ${runwayMonths} Monate Liquiditätspuffer (≥ 12 Monate)`;
      runwayBadge = 'badge-green';
    }
  }

  // 2. Share Dilution
  const dilPct = Number((((shNow - shPrev) / shPrev) * 100).toFixed(1));
  let dilText = `${dilPct > 0 ? '+' : ''}${dilPct}% Veränderung der Aktienanzahl`;
  let dilBadge = dilPct > 20 ? 'badge-red' : dilPct > 12 ? 'badge-amber' : 'badge-green';

  // Compute 4-pillar score
  let pA = burnQ >= 0 ? 18 : runwayMonths >= 15 ? 15 : runwayMonths >= 10 ? 9 : 2;
  pA += dilPct <= 10 ? 7 : dilPct <= 20 ? 4 : 0;
  pA += debtEq < 1.0 ? 5 : 1;
  if (filingStatus === 'atm') pA = Math.max(0, pA - 9);
  else if (filingStatus === 's3') pA = Math.max(0, pA - 3);

  let pB = floatM <= 15 ? 10 : floatM <= 25 ? 7 : 4;
  pB += insider >= 15 ? 10 : insider >= 10 ? 7 : 3;
  pB += shortPct >= 15 && floatM <= 20 ? 5 : 3;

  let pC = catalystType === 'turnaround' ? 23 : catalystType === 'pureplay' ? 21 : catalystType === 'pdufa' ? 19 : 4;
  let pD = techStatus === 'strong' ? 16 : techStatus === 'base' ? 12 : 3;
  pD += checkedBoxes;

  const total = Math.min(100, Math.max(5, pA + pB + pC + pD));
  const verdictCls = total >= 72 ? 'score-high' : total >= 50 ? 'score-mid' : 'score-low';
  const verdictLabel = total >= 72
    ? 'FREIGABE: Hochwertiges asymmetrisches Micro-Cap Setup'
    : total >= 50
      ? 'WATCHLIST / VORSICHT: Mischbild – Strenge Limit- & Stop-Disziplin nötig'
      : 'ABLEHNUNG (RED FLAG): Akute Verwässerungs- oder Pump-&-Dump-Gefahr!';

  document.getElementById('dd-verdict-panel').innerHTML = `
    <h3>
      <span>📊 Forensisches Due-Diligence-Urteil</span>
      <span class="score-pill ${verdictCls}">${total} / 100 Punkte</span>
    </h3>

    <div class="result-box" style="margin-block-end:0.9rem;">
      <div style="font-weight:800;font-size:0.95rem;margin-bottom:0.35rem;">${verdictLabel}</div>
      <div style="font-size:0.8rem;color:var(--text-secondary);">
        Basierend auf den 4 Säulen der Due Diligence: Cash Runway &amp; Verwässerung (${pA}/30), Float &amp; Eigentümer (${pB}/25), Katalysator-Qualität (${pC}/25) und Chart-/Volumen-Verifikation (${pD}/20).
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:0.65rem;font-size:0.83rem;">
      <div class="result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Säule A: Cash Runway &amp; Verwässerung</strong>
          <span class="badge ${runwayBadge}">${burnQ >= 0 ? 'CF POSITIV' : runwayMonths + ' Monate'}</span>
        </div>
        <p style="margin:0.35rem 0 0;color:var(--text-secondary);">${runwayText}</p>
        <div style="margin-top:0.4rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
          <span class="badge ${dilBadge}">Share Count: ${dilText}</span>
          <span class="badge ${debtEq < 1 ? 'badge-green' : 'badge-amber'}">Debt/Equity: ${debtEq}</span>
          <span class="badge ${filingStatus === 'atm' ? 'badge-red' : filingStatus === 's3' ? 'badge-amber' : 'badge-green'}">
            ${filingStatus === 'atm' ? '⚠ Aktives 424B5 ATM' : filingStatus === 's3' ? 'Offene S-3 Shelf' : 'Keine aktive ATM-Verwässerung'}
          </span>
        </div>
      </div>

      <div class="result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Säule B: Float, Insider &amp; Squeeze-Struktur</strong>
          <span class="badge ${floatM <= 20 ? 'badge-purple' : 'badge-blue'}">Float: ${floatM} Mio.</span>
        </div>
        <p style="margin:0.35rem 0 0;color:var(--text-secondary);">
          Insider-Ownership: <strong>${insider}%</strong> (${insider >= 10 ? '✓ Starkes Management-Alignment' : '⚠ Geringe Eigenbeteiligung'}) •
          Short Interest: <strong>${shortPct}%</strong> (${shortPct >= 15 && floatM <= 20 ? '💥 Explosives Short-Squeeze-Setup!' : 'Normal'})
        </p>
      </div>

      <div class="result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong>Säule C &amp; D: Katalysator &amp; Technische Struktur</strong>
          <span class="badge ${pC + pD >= 30 ? 'badge-green' : 'badge-amber'}">${pC + pD} / 45 Pkt.</span>
        </div>
        <p style="margin:0.35rem 0 0;color:var(--text-secondary);">
          ${catalystType === 'pr_only' ? '🚨 WARNUNG: Reine Werbe-/PR-Hülse ohne fundamentale Substanz!' : '✓ Fundamentaler Katalysator vorhanden.'}
          ${techStatus === 'downtrend' ? ' ⚠ Kurs unter SMA 50/200 (Dead-Cat-Bounce-Gefahr – Bodenbildung abwarten!).' : ' ✓ Chartstruktur oberhalb zentraler Unterstützungen.'}
        </p>
      </div>
    </div>
  `;
}

// ============================================================================
// VIEW 4: ASYMMETRIC EXECUTION, POSITION SIZING & CRV DESK
// ============================================================================
function loadStockIntoExecution(ticker) {
  const st = state.stocks.find((s) => s.ticker === ticker);
  if (!st) return;

  document.getElementById('exec-ticker-select').value = st.ticker;
  const en = st.entry || {};
  const entry = en.optEntryHigh || st.price;
  const atr = st.atr || entry * 0.08;
  const rawStop = en.optStop && en.optStop < entry ? en.optStop : Math.max(entry * 0.78, entry - atr * 1.8);
  const stop = Number(rawStop.toFixed(entry < 1 ? 3 : 2));
  const riskPerShare = Math.max(0.02, entry - stop);
  const target1 = Number((entry + riskPerShare * 3.5).toFixed(2));
  const target2 = Number((entry + riskPerShare * 6.0).toFixed(2));

  setVal('ex-entry', entry);
  setVal('ex-stop', stop);
  setVal('ex-target1', target1);
  setVal('ex-target2', target2);
  calculateExecutionPlan();
}

function calculateExecutionPlan() {
  const portfolio = parseFloat(document.getElementById('ex-portfolio').value) || 50000;
  const maxAllocPct = parseFloat(document.getElementById('ex-max-alloc').value) || 2.0;
  const maxRiskPct = parseFloat(document.getElementById('ex-max-risk').value) || 0.5;
  const entry = parseFloat(document.getElementById('ex-entry').value) || 2.0;
  const stop = parseFloat(document.getElementById('ex-stop').value) || 1.7;
  const target1 = parseFloat(document.getElementById('ex-target1').value) || 3.2;
  const target2 = parseFloat(document.getElementById('ex-target2').value) || 5.0;
  const partialPct = parseFloat(document.getElementById('ex-partial-pct').value) || 50;

  const riskPerShare = entry - stop;
  if (riskPerShare <= 0 || entry <= 0) {
    document.getElementById('exec-output-panel').innerHTML = `
      <div class="result-box" style="border-color:var(--accent-red);color:var(--accent-red);">
        <strong>Ungültiges Stop-Loss-Level:</strong> Der Stop-Loss muss unterhalb des Limit-Einstiegskurses liegen!
      </div>`;
    return;
  }

  const maxCapitalByExposure = portfolio * (maxAllocPct / 100);
  const maxDollarRiskAllowed = portfolio * (maxRiskPct / 100);

  const sharesByExposure = Math.floor(maxCapitalByExposure / entry);
  const sharesByRisk = Math.floor(maxDollarRiskAllowed / riskPerShare);
  const optimalShares = Math.max(1, Math.min(sharesByExposure, sharesByRisk));

  const positionValue = optimalShares * entry;
  const actualExposurePct = (positionValue / portfolio) * 100;
  const actualDollarRisk = optimalShares * riskPerShare;
  const actualPortfolioRiskPct = (actualDollarRisk / portfolio) * 100;
  const stopDistancePct = (riskPerShare / entry) * 100;

  const reward1PerShare = target1 - entry;
  const reward2PerShare = target2 - entry;
  const crv1 = reward1PerShare / riskPerShare;
  const crv2 = reward2PerShare / riskPerShare;

  const partialShares = Math.round(optimalShares * (partialPct / 100));
  const runnerShares = optimalShares - partialShares;
  const profitStage1 = partialShares * reward1PerShare;
  const cashBackStage1 = partialShares * target1;
  const profitStage2 = runnerShares * reward2PerShare;
  const totalPotentialProfit = profitStage1 + profitStage2;

  const crvOk = crv1 >= 3.0;

  document.getElementById('exec-output-panel').innerHTML = `
    <h3>
      <span>📐 Berechneter Limit-Order &amp; Asymmetrischer Exit-Plan</span>
      <span class="badge ${crvOk ? 'badge-green' : 'badge-red'}">
        CRV Ziel 1: ${crv1.toFixed(2)} : 1 ${crvOk ? '✓ (≥ 3:1 Erfüllt)' : '⚠ (< 3:1 Zu gering!)'}
      </span>
    </h3>

    <div class="grid-3" style="margin-block-end:0.9rem;">
      <div class="result-box">
        <div style="font-size:0.73rem;color:var(--text-secondary);">Optimale Stückzahl (Limit-Order)</div>
        <div class="mono" style="font-size:1.35rem;font-weight:800;color:var(--accent-primary);">${optimalShares.toLocaleString('de-DE')} Aktien</div>
        <div class="mono" style="font-size:0.75rem;color:var(--text-muted);">Limit-Kauf @ ${entry.toFixed(2)} $</div>
      </div>

      <div class="result-box">
        <div style="font-size:0.73rem;color:var(--text-secondary);">Positionsgröße (Exposure)</div>
        <div class="mono" style="font-size:1.35rem;font-weight:800;">${positionValue.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $</div>
        <div class="mono" style="font-size:0.75rem;color:${actualExposurePct <= 3 ? 'var(--accent-primary)' : 'var(--accent-amber)'};">
          ${actualExposurePct.toFixed(2)}% vom Depot (Max 1–3%)
        </div>
      </div>

      <div class="result-box">
        <div style="font-size:0.73rem;color:var(--text-secondary);">Max. Verlust bei Stop-Loss</div>
        <div class="mono" style="font-size:1.35rem;font-weight:800;color:var(--accent-red);">-${actualDollarRisk.toLocaleString('de-DE', { maximumFractionDigits: 0 })} $</div>
        <div class="mono" style="font-size:0.75rem;color:var(--text-muted);">
          -${stopDistancePct.toFixed(1)}% Stop (${actualPortfolioRiskPct.toFixed(2)}% Depotrisiko)
        </div>
      </div>
    </div>

    <div class="result-box" style="margin-block-end:0.85rem;">
      <h4 style="margin:0 0 0.5rem;font-size:0.88rem;">🚀 3-Stufen Asymmetrischer Exit-Fahrplan ("Free-Ride-Strategie"):</h4>
      <div style="display:flex;flex-direction:column;gap:0.45rem;font-size:0.82rem;">
        <div>
          <span class="badge badge-red">Stop-Loss Wächter</span>
          <strong>Hard Stop @ ${stop.toFixed(2)} $:</strong> Fällt der Kurs unter ${stop.toFixed(2)} $, werden alle ${optimalShares} Aktien kompromisslos glattgestellt (Verlust begrenzt auf ${actualDollarRisk.toFixed(0)} $). <strong>Niemals verbilligt nachkaufen!</strong>
        </div>
        <div>
          <span class="badge badge-amber">Stufe 1: De-Risking @ ${target1.toFixed(2)} $ (+${((reward1PerShare / entry) * 100).toFixed(1)}%)</span>
          Verkaufe <strong>${partialShares} Aktien (${partialPct}%)</strong> per Limit-Order → Realisierter Gewinn: <strong class="pos">+${profitStage1.toFixed(0)} $</strong> (Rückfluss: ${cashBackStage1.toFixed(0)} $). Ziehe den Stop-Loss für die restlichen ${runnerShares} Aktien auf Einstand (${entry.toFixed(2)} $) nach – <strong>der Trade ist ab sofort 100 % risikofrei!</strong>
        </div>
        <div>
          <span class="badge badge-green">Stufe 2: Multi-Bagger Runner @ ${target2.toFixed(2)} $ (+${((reward2PerShare / entry) * 100).toFixed(1)}% | CRV ${crv2.toFixed(1)}:1)</span>
          Lasse die verbleibenden <strong>${runnerShares} Aktien</strong> mit einem Trailing-Stop laufen. Gewinn auf Runner: <strong class="pos">+${profitStage2.toFixed(0)} $</strong> → <strong>Gesamtgewinn: +${totalPotentialProfit.toFixed(0)} $ (${(totalPotentialProfit / actualDollarRisk).toFixed(1)}R Multiple)</strong>.
        </div>
      </div>
    </div>
  `;
}

function initCalculatorListeners() {
  const entrySel = document.getElementById('entry-ticker-select');
  if (entrySel) {
    entrySel.addEventListener('change', (e) => loadStockIntoEntryLab(e.target.value));
  }
  document.getElementById('dd-ticker-select').addEventListener('change', (e) => loadStockIntoDdLab(e.target.value));
  document.getElementById('exec-ticker-select').addEventListener('change', (e) => loadStockIntoExecution(e.target.value));

  const entryIds = [
    'en-price', 'en-plow', 'en-phigh', 'en-vwap', 'en-sma20', 'en-sma200',
    'en-bb-upper', 'en-bb-lower', 'en-atr', 'en-vol-ratio', 'en-spread'
  ];
  entryIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calculateEntryLab);
      el.addEventListener('change', calculateEntryLab);
    }
  });

  const btnEntryToExec = document.getElementById('btn-entry-to-exec');
  if (btnEntryToExec) {
    btnEntryToExec.addEventListener('click', () => {
      const outEl = document.getElementById('entry-lab-output');
      const curTicker = document.getElementById('entry-ticker-select')?.value;
      switchToView('view-execution');
      if (curTicker) {
        document.getElementById('exec-ticker-select').value = curTicker;
      }
      if (outEl?.dataset.optEntry) setVal('ex-entry', outEl.dataset.optEntry);
      if (outEl?.dataset.optStop) setVal('ex-stop', outEl.dataset.optStop);
      if (outEl?.dataset.optTarget1) setVal('ex-target1', outEl.dataset.optTarget1);
      if (outEl?.dataset.optTarget2) setVal('ex-target2', outEl.dataset.optTarget2);
      calculateExecutionPlan();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const btnCopyPy = document.getElementById('btn-copy-python');
  if (btnCopyPy) {
    btnCopyPy.addEventListener('click', async () => {
      const codeEl = document.getElementById('python-entry-code');
      if (codeEl && navigator.clipboard) {
        await navigator.clipboard.writeText(codeEl.innerText);
        btnCopyPy.textContent = '✓ Python-Code kopiert!';
        setTimeout(() => { btnCopyPy.textContent = '📋 Python-Code kopieren'; }, 2500);
      }
    });
  }

  const ddIds = [
    'dd-cash', 'dd-burn', 'dd-shares-prev', 'dd-shares-now', 'dd-float',
    'dd-insider', 'dd-short', 'dd-debt-eq', 'dd-filing-status', 'dd-catalyst-type', 'dd-tech-status'
  ];
  ddIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calculateDdLab);
      el.addEventListener('change', calculateDdLab);
    }
  });
  document.querySelectorAll('.dd-chk').forEach((chk) => chk.addEventListener('change', calculateDdLab));

  const execIds = ['ex-portfolio', 'ex-max-alloc', 'ex-max-risk', 'ex-entry', 'ex-stop', 'ex-target1', 'ex-target2', 'ex-partial-pct'];
  execIds.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', calculateExecutionPlan);
      el.addEventListener('change', calculateExecutionPlan);
    }
  });
}

// ============================================================================
// NATIVE MODAL DIALOG INSPECTOR (modern-web-guidance: dialog)
// ============================================================================
function initDialogFallbacks() {
  const dialog = document.getElementById('stock-detail-dialog');
  if (!dialog) return;

  // MANDATORY (dialog guide): reset returnValue on close so stale values never leak
  dialog.addEventListener('close', () => {
    dialog.returnValue = '';
  });

  // Fallback for <dialog closedby="any"> where closedBy is unsupported (e.g. Safari)
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const outside = (e, dlg) => {
      const r = dlg.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    for (const dlg of document.querySelectorAll('dialog[closedby="any"]')) {
      let pressedOutside = false;
      dlg.addEventListener('pointerdown', (e) => { pressedOutside = outside(e, dlg); });
      dlg.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e, dlg)) dlg.close(); });
    }
  }

  document.getElementById('dialog-btn-to-dd').addEventListener('click', () => {
    if (state.selectedStock) {
      dialog.close();
      switchToView('view-dd-lab');
      loadStockIntoDdLab(state.selectedStock.ticker);
    }
  });

  document.getElementById('dialog-btn-to-exec').addEventListener('click', () => {
    if (state.selectedStock) {
      dialog.close();
      switchToView('view-execution');
      loadStockIntoExecution(state.selectedStock.ticker);
    }
  });
}

function openStockDialog(ticker) {
  const st = state.stocks.find((s) => s.ticker === ticker);
  if (!st) return;
  state.selectedStock = st;

  const cur = st.currency === 'EUR' ? '€' : '$';
  document.getElementById('dialog-stock-title').textContent = `${st.ticker} • ${st.price} ${cur} (${st.change >= 0 ? '+' : ''}${st.change}%)`;
  document.getElementById('dialog-stock-exchange').textContent = st.exchange;
  document.getElementById('dialog-stock-theme').textContent = st.theme;

  const sc = st.scores.total;
  const scoreEl = document.getElementById('dialog-stock-score');
  scoreEl.textContent = `Forensik-Score: ${sc} / 100`;
  scoreEl.className = `score-pill ${sc >= 72 ? 'score-high' : sc >= 52 ? 'score-mid' : 'score-low'}`;
  document.getElementById('dialog-stock-name').textContent = `${st.name} • ${st.sector} / ${st.industry}`;

  const tvSymbol = `${st.exchange}:${st.ticker}`;
  const themeAttr = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  const STUDY_PRESETS = {
    entry: 'BB%40tv-basicstudies%1FKeltnerChannels%40tv-basicstudies%1FVWAP%40tv-basicstudies%1FMASimple%40tv-basicstudies',
    momentum: 'MASimple%40tv-basicstudies%1FVWAP%40tv-basicstudies%1FRSI%40tv-basicstudies%1FMACD%40tv-basicstudies',
    clean: 'VWAP%40tv-basicstudies%1FMASimple%40tv-basicstudies'
  };
  let currentTvInterval = 'D';
  let currentStudyPreset = 'entry';
  const buildChartUrl = (interval = currentTvInterval, studyKey = currentStudyPreset) => {
    const studies = STUDY_PRESETS[studyKey] || STUDY_PRESETS.entry;
    return `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=${encodeURIComponent(interval)}&hidesidetoolbar=0&withdateranges=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=${studies}&theme=${themeAttr}&style=1&timezone=Etc%2FUTC`;
  };
  const chartUrl = buildChartUrl('D', 'entry');
  const en = st.entry || {};
  const confScore = en.confluenceScore ?? 55;
  const pineCode = generateTradingViewPineScript(st);

  const bullHtml = (st.bullSignals || []).length
    ? st.bullSignals.map((b) => `<div class="checklist-item" style="border-inline-start:3px solid var(--accent-primary);">✅ <span>${escapeHtml(b)}</span></div>`).join('')
    : `<div class="checklist-item">Keine außergewöhnlichen Bull-Signale erkannt.</div>`;

  const redHtml = (st.redFlags || []).length
    ? st.redFlags.map((r) => `<div class="checklist-item" style="border-inline-start:3px solid var(--accent-red);">🚨 <span>${escapeHtml(r)}</span></div>`).join('')
    : `<div class="checklist-item" style="border-inline-start:3px solid var(--accent-primary);">✓ Keine akuten forensischen Red Flags (Cash Runway, Kurs &gt; 1$ &amp; Dilution im Rahmen).</div>`;

  const filings = st.sec?.recentFilings || [];
  const filingsHtml = filings.length
    ? filings.map((f) => `
        <a href="${f.url}" target="_blank" rel="noopener" class="btn btn-sm" style="justify-content:space-between;">
          <span class="mono"><strong>Form ${escapeHtml(f.form)}</strong> (${f.date})</span>
          <span>SEC Filing ↗</span>
        </a>
      `).join('')
    : `<span style="font-size:0.8rem;color:var(--text-muted);">Keine aktuellen Spezial-Filings im Kurz-Cache – nutze den direkten SEC EDGAR Link rechts.</span>`;

  const shHist = st.sharesHistory || {};

  document.getElementById('dialog-body-content').innerHTML = `
    <!-- External Research Deep-Links -->
    <div style="display:flex;flex-wrap:wrap;gap:0.45rem;align-items:center;justify-content:space-between;">
      <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
        ${st.setups.map((s) => SETUP_BADGE_MAP[s] ? `<span class="badge ${SETUP_BADGE_MAP[s].cls}">${SETUP_BADGE_MAP[s].label}</span>` : '').join('')}
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
        <a href="https://finviz.com/quote.ashx?t=${st.ticker}" target="_blank" rel="noopener" class="btn btn-sm">Finviz Quote ↗</a>
        ${st.sec?.cik ? `<a href="https://www.sec.gov/edgar/browse/?CIK=${st.sec.cik}" target="_blank" rel="noopener" class="btn btn-sm">SEC EDGAR (${st.sec.cik}) ↗</a>` : `<a href="https://www.sec.gov/edgar/searchedgar/companysearch" target="_blank" rel="noopener" class="btn btn-sm">SEC EDGAR ↗</a>`}
        <a href="http://openinsider.com/search?q=${st.ticker}" target="_blank" rel="noopener" class="btn btn-sm">OpenInsider (Form 4) ↗</a>
        <a href="https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSymbol)}" target="_blank" rel="noopener" class="btn btn-sm">TradingView Extern ↗</a>
      </div>
    </div>

    <!-- Interactive Chart Workbench (TradingView + Live Entry-HUD + Drawn Entry-Zone Canvas + Pine Script v5) -->
    <div class="chart-workbench" id="dialog-chart-workbench">
      <div class="chart-toolbar">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.45rem;">
          <span class="mono" style="font-size:0.75rem;font-weight:700;color:var(--text-secondary);">📈 ANSICHT:</span>
          <div class="chart-btn-group" role="group" aria-label="Chart-Modus wählen">
            <button type="button" class="chart-ctrl-btn active" data-chart-mode="split" title="TradingView Chart links + eingezeichnete Golden Pocket, AVWAP &amp; Volume Profile rechts">⚡ Split: TradingView + Entry-Zonen</button>
            <button type="button" class="chart-ctrl-btn" data-chart-mode="tv" title="Vollbreite TradingView Chart mit eingeblendetem Entry-Zonen-HUD">📈 TradingView (+ Entry-HUD)</button>
            <button type="button" class="chart-ctrl-btn" data-chart-mode="zones" title="Vollbreite interaktiver Entry-Zonen-Chart (Golden Pocket 0.618–0.786, 0.886 Stop, AVWAP &amp; VPOC)">🎯 Entry-Zonen-Chart (Vollbild)</button>
          </div>

          <div class="chart-btn-group" role="group" aria-label="Zeiteinheit wählen">
            <button type="button" class="chart-ctrl-btn" data-tv-interval="5">5m</button>
            <button type="button" class="chart-ctrl-btn" data-tv-interval="15">15m</button>
            <button type="button" class="chart-ctrl-btn" data-tv-interval="60">1H</button>
            <button type="button" class="chart-ctrl-btn" data-tv-interval="240">4H</button>
            <button type="button" class="chart-ctrl-btn active" data-tv-interval="D">1T</button>
            <button type="button" class="chart-ctrl-btn" data-tv-interval="W">1W</button>
          </div>

          <div class="chart-btn-group" role="group" aria-label="TradingView Indikatoren wählen">
            <button type="button" class="chart-ctrl-btn active" id="btn-toggle-tv-overlay" title="Zeichnet Golden Pocket (0.618–0.786), 0.886 Stop &amp; AVWAP direkt als Zonen-Layer über das TradingView-Fenster">🎯 Zonen im TV-Fenster: EIN</button>
            <button type="button" class="chart-ctrl-btn active" data-tv-study="entry" title="Lädt Bollinger Bands + Keltner Channels (Squeeze) + VWAP + Moving Average direkt in TradingView">🗜️ BB+KC &amp; VWAP</button>
            <button type="button" class="chart-ctrl-btn" data-tv-study="momentum" title="Lädt Moving Average + VWAP + RSI + MACD in TradingView">📊 RSI &amp; MACD</button>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.45rem;">
          <button type="button" class="btn btn-sm" id="btn-toggle-pine-drawer" title="Pine Script v5 Indikator mit allen Entry-Zonen für dein eigenes TradingView kopieren">
            🌲 Pine Script (TradingView)
          </button>
          <div class="chart-btn-group" role="group" aria-label="Chart-Größe anpassen">
            <button type="button" class="chart-ctrl-btn" data-chart-size="size-compact">520px</button>
            <button type="button" class="chart-ctrl-btn active" data-chart-size="size-work">72% Höhe</button>
            <button type="button" class="chart-ctrl-btn" data-chart-size="size-max">84% Höhe</button>
          </div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-toggle-chart-fullscreen">
            ⤢ Vollbild-Arbeitsmodus
          </button>
        </div>
      </div>

      <!-- Collapsible Pine Script v5 Drawer for external TradingView -->
      <div class="pine-code-drawer is-hidden" id="dialog-pine-drawer">
        <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.45rem;">
          <div style="font-size:0.78rem;">
            <strong>🌲 TradingView Pine Script v5 Indikator (${st.ticker}):</strong> Zeichnet Golden Pocket (<code>0.618–0.786</code>), <code>0.886 Stop</code>, <code>Anchor-VWAP</code>, <code>BB/KC Squeeze</code> und die <code>100-Punkte Confluence-Tabelle</code> direkt in dein eigenes TradingView (<em>Pine Editor → Einfügen → Zum Chart hinzufügen</em>).
          </div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-copy-dialog-pine">📋 Pine Script v5 kopieren</button>
        </div>
        <pre id="dialog-pine-pre" class="mono" style="max-block-size:190px;overflow:auto;background:var(--bg-surface);padding:0.65rem;border-radius:4px;border:1px solid var(--border-subtle);font-size:0.72rem;margin:0;"><code>${escapeHtml(pineCode)}</code></pre>
      </div>

      <div class="chart-frame size-work mode-split" id="dialog-chart-frame">
        <!-- PANE 1: Live TradingView Widget + Overlaid Entry-Zone HUD -->
        <div class="chart-pane" id="tv-iframe-pane">
          <div class="tv-entry-hud" id="tv-entry-hud">
            <div class="tv-hud-header">
              <div style="display:flex;align-items:center;gap:0.35rem;">
                <span class="badge ${confScore >= 80 ? 'badge-green' : 'badge-amber'}">🎯 Conf: ${confScore}/100</span>
                <strong class="mono" style="font-size:0.75rem;">Entry-Leitstand (${st.ticker})</strong>
              </div>
              <div style="display:flex;gap:0.25rem;">
                <button type="button" class="chart-ctrl-btn" id="btn-hud-side" title="HUD links/rechts verschieben" style="padding:0.1rem 0.35rem;">⇄</button>
                <button type="button" class="chart-ctrl-btn" id="btn-hud-min" title="HUD minimieren/ausklappen" style="padding:0.1rem 0.4rem;">−</button>
              </div>
            </div>
            <div class="tv-hud-body">
              <div class="tv-hud-row">
                <span style="color:#94a3b8;">🔼 Swing-Peak (P_high / Ziel 1):</span>
                <strong style="color:#38bdf8;">${en.swingHigh ?? '—'} ${cur}</strong>
              </div>
              <div class="tv-hud-row" style="background:rgba(16,185,129,0.14);padding:2px 5px;border-radius:4px;border-inline-start:3px solid #10b981;">
                <span style="color:#a7f3d0;font-weight:700;">🟢 Golden Pocket (0.618–0.786):</span>
                <strong style="color:#10b981;">${en.fib786 ?? '—'} – ${en.fib618 ?? '—'} ${cur}</strong>
              </div>
              <div class="tv-hud-row" style="background:rgba(239,68,68,0.14);padding:2px 5px;border-radius:4px;border-inline-start:3px solid #ef4444;">
                <span style="color:#fca5a5;font-weight:700;">🛑 Invalidation Stop (0.886):</span>
                <strong style="color:#ef4444;">${en.fib886Stop ?? '—'} ${cur}</strong>
              </div>
              <div class="tv-hud-row">
                <span style="color:#94a3b8;">⚓ Anchor-VWAP / VAH (70%):</span>
                <strong style="color:#06b6d4;">${en.avwapAnchor ?? st.vwap ?? '—'} / ${en.vah ?? '—'} ${cur}</strong>
              </div>
              <div class="tv-hud-row">
                <span style="color:#94a3b8;">📊 Volume POC (VPOC) / SMA20:</span>
                <strong>${en.vpoc ?? '—'} / ${st.sma20 ?? '—'} ${cur}</strong>
              </div>
              <div class="tv-hud-row">
                <span style="color:#94a3b8;">🗜️ BB/KC Squeeze (20, 2.0 / 1.5):</span>
                <strong style="color:${en.isSqueeze ? '#10b981' : '#f59e0b'};">${en.isSqueeze ? (en.squeezeTrigger ? '🔥 SQUEEZE TRIGGER!' : '🗜️ SQUEEZE ON') : 'Expansion'}</strong>
              </div>
              <div class="tv-hud-zone-bar">
                <div class="tv-hud-zone-pill" title="Trend > SMA 200 / Higher Low">Trend<br><strong style="color:#10b981;">${en.breakdown?.trend ?? 0}/25</strong></div>
                <div class="tv-hud-zone-pill" title="Golden Pocket / AVWAP / Squeeze">Zone<br><strong style="color:#10b981;">${en.breakdown?.zone ?? 0}/30</strong></div>
                <div class="tv-hud-zone-pill" title="Pullback Volume Dry-Up (<50%)">Vol-Dry<br><strong style="color:#38bdf8;">${en.breakdown?.volume ?? 0}/25</strong></div>
                <div class="tv-hud-zone-pill" title="Orderbuch Spread < 1.5%">Spread<br><strong style="color:#f59e0b;">${en.breakdown?.spread ?? 0}/20</strong></div>
              </div>
            </div>
          </div>

          <!-- DIRECT ON-CHART ENTRY-ZONE OVERLAY INSIDE TRADINGVIEW WINDOW -->
          <div class="tv-zone-overlay" id="tv-zone-overlay">
            <!-- Golden Pocket Shaded Band (0.618 - 0.786) -->
            <div class="tv-overlay-band" id="tvo-gp-band" style="background:linear-gradient(180deg, rgba(16,185,129,0.22), rgba(245,158,11,0.20));border-top:2px solid #10b981;border-bottom:2px solid #f59e0b;">
              <span class="mono" style="font-size:0.72rem;font-weight:800;color:#a7f3d0;background:rgba(6,78,59,0.85);padding:2px 8px;border-radius:4px;border:1px solid rgba(16,185,129,0.5);">
                🎯 GOLDEN POCKET ENTRY-ZONE (0.618–0.786): ${en.fib786 ?? '—'} – ${en.fib618 ?? '—'} ${cur}
              </span>
            </div>

            <!-- Invalidation Stop Band (0.886 - P_low) -->
            <div class="tv-overlay-band" id="tvo-stop-band" style="background:rgba(239,68,68,0.14);border-top:2px dashed #ef4444;"></div>

            <!-- P_high Handle (0.0% Swing Peak) -->
            <div class="tv-overlay-line" id="tvo-line-phigh" style="border-top:1.5px dotted #38bdf8;">
              <div class="tv-overlay-handle" id="tvo-handle-phigh" style="background:#0284c7;color:#fff;border:1px solid #38bdf8;" title="Ziehe diesen Griff auf das Impuls-Hoch (P_high) im TradingView-Chart">
                ⇕ P_high (0%): ${en.swingHigh ?? '—'} ${cur}
              </div>
            </div>

            <!-- 50% Fib Reference Line -->
            <div class="tv-overlay-line" id="tvo-line-fib50" style="border-top:1px dashed rgba(148,163,184,0.45);">
              <span class="tv-overlay-tag" style="background:rgba(15,23,42,0.85);color:#cbd5e1;">50.0% Retest</span>
            </div>

            <!-- 0.618 Golden Pocket Top Line -->
            <div class="tv-overlay-line" id="tvo-line-618">
              <span class="tv-overlay-tag" style="background:#065f46;color:#6ee7b7;border:1px solid #10b981;">
                🟢 0.618 Entry-Top: ${en.fib618 ?? '—'} ${cur}
              </span>
            </div>

            <!-- 0.786 Golden Pocket Bottom Line -->
            <div class="tv-overlay-line" id="tvo-line-786">
              <span class="tv-overlay-tag" style="background:#78350f;color:#fde68a;border:1px solid #f59e0b;">
                🟢 0.786 Entry-Low: ${en.fib786 ?? '—'} ${cur}
              </span>
            </div>

            <!-- 0.886 Invalidation Stop Line -->
            <div class="tv-overlay-line" id="tvo-line-886">
              <span class="tv-overlay-tag" style="background:#7f1d1d;color:#fecaca;border:1px solid #ef4444;">
                🛑 0.886 Stop-Loss: ${en.fib886Stop ?? '—'} ${cur}
              </span>
            </div>

            <!-- Anchor-VWAP / VPOC Support Line -->
            <div class="tv-overlay-line" id="tvo-line-avwap" style="border-top:2px solid #06b6d4;">
              <span class="tv-overlay-tag" style="background:#164e63;color:#67e8f9;border:1px solid #06b6d4;margin-inline-end:155px;">
                ⚓ AVWAP: ${en.avwapAnchor ?? st.vwap ?? '—'} ${cur} • VPOC: ${en.vpoc ?? '—'} ${cur}
              </span>
            </div>

            <!-- P_low Handle (100% Swing Low Anchor) -->
            <div class="tv-overlay-line" id="tvo-line-plow" style="border-top:1.5px dotted #94a3b8;">
              <div class="tv-overlay-handle" id="tvo-handle-plow" style="background:#334155;color:#f8fafc;border:1px solid #94a3b8;" title="Ziehe diesen Griff auf das Impuls-Tief (P_low) im TradingView-Chart">
                ⇕ P_low (100%): ${en.swingLow ?? '—'} ${cur}
              </div>
            </div>
          </div>

          <iframe
            id="dialog-tv-iframe"
            title="TradingView Live Chart für ${st.ticker}"
            src="${chartUrl}"
            style="inline-size:100%;block-size:100%;border:0;"
            allowfullscreen>
          </iframe>
        </div>

        <!-- PANE 2: Interactive Visual Entry-Zone, Golden Pocket, AVWAP & Volume Profile Canvas -->
        <div class="chart-pane" id="entry-visual-pane" style="display:flex;flex-direction:column;">
          <div style="padding:0.4rem 0.7rem;background:rgba(15,23,42,0.95);border-block-end:1px solid var(--border-subtle);display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:0.4rem;font-size:0.73rem;">
            <div class="mono" style="display:flex;align-items:center;gap:0.45rem;">
              <strong style="color:var(--accent-primary);">🎯 EINGEZEICHNETE ENTRY-ZONEN (${st.ticker})</strong>
              <span style="color:var(--text-muted);">| Maus bewegen für Live-Fib &amp; CRV-Fadenkreuz</span>
            </div>
            <div class="mono" style="display:flex;gap:0.55rem;font-size:0.7rem;">
              <span style="color:#10b981;">■ Golden Pocket (0.618–0.786)</span>
              <span style="color:#ef4444;">--- 0.886 Stop</span>
              <span style="color:#06b6d4;">━ Anchor-VWAP</span>
              <span style="color:#a855f7;">▨ VPOC / VAH</span>
            </div>
          </div>
          <div style="flex:1 1 auto;position:relative;min-block-size:0;">
            <canvas id="entry-zone-canvas" style="inline-size:100%;block-size:100%;display:block;cursor:crosshair;"></canvas>
          </div>
        </div>
      </div>
    </div>

    <!-- Algorithmic Entry-Zone & 100-Point Confluence Breakdown -->
    <div class="result-box" style="border-color:rgba(16, 185, 129, 0.35);">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:0.5rem;margin-bottom:0.55rem;">
        <div style="display:flex;align-items:center;gap:0.5rem;">
          <strong style="font-size:0.9rem;">🎯 Algorithmische Entry-Zonen &amp; 100-Punkte Confluence-Analyse</strong>
          <span class="badge ${(st.entry?.confluenceScore || 0) >= 80 ? 'badge-green' : 'badge-amber'}">
            Confluence: ${st.entry?.confluenceScore ?? 55} / 100 ${(st.entry?.confluenceScore || 0) >= 80 ? '• ENTRY ALERT' : ''}
          </span>
        </div>
        <button type="button" class="btn btn-sm" id="dialog-btn-to-entry-lab">
          🎯 Im Entry-Zonen-Rechner öffnen →
        </button>
      </div>
      <div class="grid-4" style="gap:0.55rem;">
        <div class="mono" style="font-size:0.77rem;">
          <div style="color:var(--text-secondary);">1. Golden Pocket (61.8–78.6%)</div>
          <div style="font-weight:800;color:var(--accent-amber);">${st.entry?.fib786 ?? '—'} – ${st.entry?.fib618 ?? '—'} ${cur}</div>
          <div style="color:var(--text-muted);">0.886 Stop: <strong class="neg">${st.entry?.fib886Stop ?? '—'} ${cur}</strong></div>
        </div>
        <div class="mono" style="font-size:0.77rem;">
          <div style="color:var(--text-secondary);">2. AVWAP &amp; Volume Profile</div>
          <div style="font-weight:800;color:var(--accent-cyan);">AVWAP: ${st.entry?.avwapAnchor ?? st.vwap ?? '—'} ${cur}</div>
          <div style="color:var(--text-muted);">VPOC: ${st.entry?.vpoc ?? '—'} • VAH: ${st.entry?.vah ?? '—'} ${cur}</div>
        </div>
        <div class="mono" style="font-size:0.77rem;">
          <div style="color:var(--text-secondary);">3. BB / Keltner Squeeze</div>
          <div style="font-weight:800;color:${st.entry?.isSqueeze ? 'var(--accent-primary)' : 'var(--text-primary)'};">
            ${st.entry?.isSqueeze ? '🗜️ SQUEEZE ON (Aktiv)' : 'Normal (Kein Squeeze)'}
          </div>
          <div style="color:var(--text-muted);">Pullback-Vol: ${st.entry?.pullbackVolRatio ?? '—'}% • Spread: ~${st.entry?.estSpreadPct ?? '—'}%</div>
        </div>
        <div class="mono" style="font-size:0.77rem;">
          <div style="color:var(--text-secondary);">4. Optimale Limit-Zone</div>
          <div style="font-weight:800;color:var(--accent-primary);">${st.entry?.optEntryLow ?? '—'} – ${st.entry?.optEntryHigh ?? '—'} ${cur}</div>
          <div style="color:var(--text-muted);">Trend(${st.entry?.breakdown?.trend ?? 0}) + Zone(${st.entry?.breakdown?.zone ?? 0}) + Vol(${st.entry?.breakdown?.volume ?? 0}) + Spr(${st.entry?.breakdown?.spread ?? 0})</div>
        </div>
      </div>
    </div>

    <!-- 4-Pillar Scorecard Breakdown -->
    <div class="grid-4">
      <div class="result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
          <strong>A. Cash &amp; Dilution</strong>
          <span class="badge badge-blue">${st.scores.cashDilution} / 30</span>
        </div>
        <div class="mono" style="font-size:0.78rem;display:flex;flex-direction:column;gap:0.2rem;">
          <span>Cash Runway: <strong>${st.cashStatus === 'positive' ? 'CF Positiv' : (st.cashRunwayMonths + ' Mon.')}</strong></span>
          <span>Cash-Bestand: <strong>${st.cashM != null ? st.cashM + 'M ' + cur : '—'}</strong></span>
          <span>Oper. CF (Q): <strong>${st.ocfQuarterlyM != null ? st.ocfQuarterlyM + 'M ' + cur : '—'}</strong></span>
          <span>Share Dilution YoY: <strong>${st.dilutionYoY > 0 ? '+' : ''}${st.dilutionYoY}%</strong></span>
          <span>Debt / Equity: <strong>${st.debtToEquity}</strong></span>
        </div>
      </div>

      <div class="result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
          <strong>B. Float &amp; Ownership</strong>
          <span class="badge badge-purple">${st.scores.floatOwnership} / 25</span>
        </div>
        <div class="mono" style="font-size:0.78rem;display:flex;flex-direction:column;gap:0.2rem;">
          <span>Freier Float: <strong>${st.floatM} Mio.</strong></span>
          <span>Shares Out: <strong>${st.sharesOutM ?? '—'} Mio.</strong></span>
          <span>Insider Own: <strong>${st.insiderOwn}% (${st.insiderTrans > 0 ? '+' : ''}${st.insiderTrans}%)</strong></span>
          <span>Inst. Own: <strong>${st.instOwn}% (${st.instTrans > 0 ? '+' : ''}${st.instTrans}%)</strong></span>
          <span>Short Float: <strong>${st.shortFloat}% (${st.shortRatio}d Cover)</strong></span>
        </div>
      </div>

      <div class="result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
          <strong>C. Wachstum &amp; Katalysator</strong>
          <span class="badge badge-green">${st.scores.catalystGrowth} / 25</span>
        </div>
        <div class="mono" style="font-size:0.78rem;display:flex;flex-direction:column;gap:0.2rem;">
          <span>Sales Q/Q: <strong>${st.revGrowthQoQ != null ? st.revGrowthQoQ + '%' : '—'}</strong></span>
          <span>Sales YoY: <strong>${st.revGrowthYoY != null ? st.revGrowthYoY + '%' : '—'}</strong></span>
          <span>EBITDA (Q): <strong>${st.ebitdaQuarterlyM != null ? st.ebitdaQuarterlyM + 'M ' + cur : '—'}</strong></span>
          <span>Bruttomarge: <strong>${st.grossMargin != null ? st.grossMargin + '%' : '—'}</strong></span>
          <span>Nächste Earnings: <strong>${st.nextEarnings || 'TBA'}</strong></span>
        </div>
      </div>

      <div class="result-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.35rem;">
          <strong>D. Technische Struktur</strong>
          <span class="badge badge-cyan">${st.scores.technicals} / 20</span>
        </div>
        <div class="mono" style="font-size:0.78rem;display:flex;flex-direction:column;gap:0.2rem;">
          <span>RVOL (10D): <strong>${st.rvol}x (Ø ${(st.avgVolume / 1e3).toFixed(0)}k)</strong></span>
          <span>SMA 50 / 200: <strong>${st.sma50 ?? '—'} / ${st.sma200 ?? '—'}</strong></span>
          <span>VWAP / RSI(14): <strong>${st.vwap ?? '—'} / ${st.rsi ?? '—'}</strong></span>
          <span>3M Range: <strong>${st.range3MPct != null ? st.range3MPct + '%' : '—'}</strong></span>
          <span>52W Spanne: <strong>${st.low52W ?? '—'} – ${st.high52W ?? '—'}</strong></span>
        </div>
      </div>
    </div>

    <!-- Bullish Catalysts vs. Forensic Red Flags -->
    <div class="grid-2">
      <div>
        <h4 style="margin:0 0 0.45rem;font-size:0.88rem;">🚀 Explosive Katalysatoren &amp; Stärken</h4>
        ${bullHtml}
      </div>
      <div>
        <h4 style="margin:0 0 0.45rem;font-size:0.88rem;">⚠️ Forensische Red Flags &amp; Risiken</h4>
        ${redHtml}
      </div>
    </div>

    <!-- Share Count History & SEC EDGAR Filings -->
    <div class="grid-2">
      <div class="result-box">
        <h4 style="margin:0 0 0.45rem;font-size:0.86rem;">📉 Share Count History (Verwässerungs-Historie)</h4>
        <div class="mono" style="display:flex;justify-content:space-between;font-size:0.8rem;padding-top:0.25rem;">
          <span>2023: <strong>${shHist['2023'] ? shHist['2023'] + 'M' : '—'}</strong></span>
          <span>→</span>
          <span>2024: <strong>${shHist['2024'] ? shHist['2024'] + 'M' : '—'}</strong></span>
          <span>→</span>
          <span>2025: <strong>${shHist['2025'] ? shHist['2025'] + 'M' : '—'}</strong></span>
          <span>→</span>
          <span>Heute: <strong>${shHist.current ? shHist.current + 'M' : '—'} (${st.dilutionYoY > 0 ? '+' : ''}${st.dilutionYoY}%)</strong></span>
        </div>
      </div>

      <div class="result-box">
        <h4 style="margin:0 0 0.45rem;font-size:0.86rem;">📂 Verifizierte SEC EDGAR Filings (Direkt-Dokumente)</h4>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(195px,1fr));gap:0.35rem;">
          ${filingsHtml}
        </div>
      </div>
    </div>
  `;

  // Bind interactive Chart Workbench controls
  const bodyEl = document.getElementById('dialog-body-content');
  const iframeEl = document.getElementById('dialog-tv-iframe');
  const frameEl = document.getElementById('dialog-chart-frame');
  const workbenchEl = document.getElementById('dialog-chart-workbench');
  const fsBtn = document.getElementById('btn-toggle-chart-fullscreen');
  const tvPane = document.getElementById('tv-iframe-pane');
  const zonesPane = document.getElementById('entry-visual-pane');
  const canvasEl = document.getElementById('entry-zone-canvas');
  const hudEl = document.getElementById('tv-entry-hud');
  let activeChartMode = 'split';
  let activeSizeClass = 'size-work';

  const syncFrameClass = () => {
    if (!frameEl) return;
    frameEl.className = `chart-frame ${activeSizeClass} ${activeChartMode === 'split' ? 'mode-split' : ''}`;
  };

  bodyEl.querySelectorAll('[data-chart-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      bodyEl.querySelectorAll('[data-chart-mode]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeChartMode = btn.dataset.chartMode;
      if (tvPane) tvPane.classList.toggle('is-hidden', activeChartMode === 'zones');
      if (zonesPane) zonesPane.classList.toggle('is-hidden', activeChartMode === 'tv');
      syncFrameClass();
      requestAnimationFrame(() => {
        if (canvasEl && activeChartMode !== 'tv') renderEntryZoneCanvas(canvasEl, st);
      });
    });
  });

  bodyEl.querySelectorAll('[data-tv-interval]').forEach((btn) => {
    btn.addEventListener('click', () => {
      bodyEl.querySelectorAll('[data-tv-interval]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentTvInterval = btn.dataset.tvInterval;
      if (iframeEl) {
        iframeEl.src = buildChartUrl(currentTvInterval, currentStudyPreset);
      }
    });
  });

  bodyEl.querySelectorAll('[data-tv-study]').forEach((btn) => {
    btn.addEventListener('click', () => {
      bodyEl.querySelectorAll('[data-tv-study]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentStudyPreset = btn.dataset.tvStudy;
      if (iframeEl) {
        iframeEl.src = buildChartUrl(currentTvInterval, currentStudyPreset);
      }
    });
  });

  bodyEl.querySelectorAll('[data-chart-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      bodyEl.querySelectorAll('[data-chart-size]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      activeSizeClass = btn.dataset.chartSize;
      if (workbenchEl) workbenchEl.classList.remove('is-fullscreen');
      if (fsBtn) fsBtn.textContent = '⤢ Vollbild-Arbeitsmodus';
      if (frameEl) {
        frameEl.style.height = '';
        syncFrameClass();
      }
      requestAnimationFrame(() => {
        if (canvasEl && activeChartMode !== 'tv') renderEntryZoneCanvas(canvasEl, st);
      });
    });
  });

  if (fsBtn && workbenchEl) {
    fsBtn.addEventListener('click', () => {
      const isFs = workbenchEl.classList.toggle('is-fullscreen');
      fsBtn.textContent = isFs ? '✕ Vollbild beenden' : '⤢ Vollbild-Arbeitsmodus';
      requestAnimationFrame(() => {
        if (canvasEl && activeChartMode !== 'tv') renderEntryZoneCanvas(canvasEl, st);
      });
    });
  }

  // HUD controls inside TradingView window
  const btnHudSide = document.getElementById('btn-hud-side');
  const btnHudMin = document.getElementById('btn-hud-min');
  if (btnHudSide && hudEl) {
    btnHudSide.addEventListener('click', () => hudEl.classList.toggle('pos-right'));
  }
  if (btnHudMin && hudEl) {
    btnHudMin.addEventListener('click', () => {
      const isMin = hudEl.classList.toggle('is-minimized');
      btnHudMin.textContent = isMin ? '+' : '−';
    });
  }

  // Direct On-Chart Zone Overlay inside TradingView window
  const tvOverlayEl = document.getElementById('tv-zone-overlay');
  const btnToggleTvOverlay = document.getElementById('btn-toggle-tv-overlay');
  if (btnToggleTvOverlay && tvOverlayEl) {
    btnToggleTvOverlay.addEventListener('click', () => {
      const hidden = tvOverlayEl.classList.toggle('is-hidden');
      btnToggleTvOverlay.classList.toggle('active', !hidden);
      btnToggleTvOverlay.textContent = hidden ? '🎯 Zonen im TV-Fenster: AUS' : '🎯 Zonen im TV-Fenster: EIN';
    });
  }
  initTvZoneOverlay(st);

  // Pine Script v5 drawer & copy
  const btnPineDrawer = document.getElementById('btn-toggle-pine-drawer');
  const pineDrawer = document.getElementById('dialog-pine-drawer');
  const btnCopyPine = document.getElementById('btn-copy-dialog-pine');
  if (btnPineDrawer && pineDrawer) {
    btnPineDrawer.addEventListener('click', () => {
      pineDrawer.classList.toggle('is-hidden');
    });
  }
  if (btnCopyPine) {
    btnCopyPine.addEventListener('click', async () => {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(pineCode);
        btnCopyPine.textContent = '✓ Pine Script kopiert!';
        setTimeout(() => { btnCopyPine.textContent = '📋 Pine Script v5 kopieren'; }, 2500);
      }
    });
  }

  const toEntryBtn = document.getElementById('dialog-btn-to-entry-lab');
  if (toEntryBtn) {
    toEntryBtn.addEventListener('click', () => {
      const dialog = document.getElementById('stock-detail-dialog');
      dialog.close();
      switchToView('view-entry-radar');
      loadStockIntoEntryLab(st.ticker);
    });
  }

  const dialog = document.getElementById('stock-detail-dialog');
  if (!dialog.open) {
    dialog.showModal();
  }

  // Render interactive Entry-Zone & Volume Profile Canvas after modal opens
  requestAnimationFrame(() => {
    if (canvasEl) {
      renderEntryZoneCanvas(canvasEl, st);
    }
  });
}

// ============================================================================
// DIRECT ON-CHART TRADINGVIEW ENTRY-ZONE OVERLAY & DRAG CALIBRATOR
// ============================================================================
function initTvZoneOverlay(st) {
  const overlay = document.getElementById('tv-zone-overlay');
  if (!overlay) return;

  const gpBand = document.getElementById('tvo-gp-band');
  const stopBand = document.getElementById('tvo-stop-band');
  const linePhigh = document.getElementById('tvo-line-phigh');
  const lineFib50 = document.getElementById('tvo-line-fib50');
  const line618 = document.getElementById('tvo-line-618');
  const line786 = document.getElementById('tvo-line-786');
  const line886 = document.getElementById('tvo-line-886');
  const lineAvwap = document.getElementById('tvo-line-avwap');
  const linePlow = document.getElementById('tvo-line-plow');
  const handlePhigh = document.getElementById('tvo-handle-phigh');
  const handlePlow = document.getElementById('tvo-handle-plow');

  const en = st.entry || {};
  const pLow = en.swingLow ?? st.price * 0.75;
  const pHigh = en.swingHigh ?? st.price * 1.25;
  const avwap = en.avwapAnchor ?? st.vwap ?? st.price;
  const range = Math.max(0.01, pHigh - pLow);
  const avwapRel = Math.min(0.95, Math.max(0.05, (pHigh - avwap) / range));

  let topPct = 14; // P_high (0% Fib)
  let botPct = 84; // P_low (100% Fib)

  const updatePositions = () => {
    const span = Math.max(18, botPct - topPct);
    const y50 = topPct + 0.500 * span;
    const y618 = topPct + 0.618 * span;
    const y786 = topPct + 0.786 * span;
    const y886 = topPct + 0.886 * span;
    const yAvwap = topPct + avwapRel * span;

    if (linePhigh) linePhigh.style.top = `${topPct}%`;
    if (lineFib50) lineFib50.style.top = `${y50}%`;
    if (line618) line618.style.top = `${y618}%`;
    if (line786) line786.style.top = `${y786}%`;
    if (line886) line886.style.top = `${y886}%`;
    if (lineAvwap) lineAvwap.style.top = `${yAvwap}%`;
    if (linePlow) linePlow.style.top = `${botPct}%`;

    if (gpBand) {
      gpBand.style.top = `${y618}%`;
      gpBand.style.height = `${Math.max(2, y786 - y618)}%`;
    }
    if (stopBand) {
      stopBand.style.top = `${y886}%`;
      stopBand.style.height = `${Math.max(2, botPct - y886)}%`;
    }
  };

  updatePositions();

  const bindDrag = (handleEl, isTop) => {
    if (!handleEl) return;
    let dragging = false;
    handleEl.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dragging = true;
      handleEl.setPointerCapture(e.pointerId);
    });
    handleEl.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = overlay.getBoundingClientRect();
      if (!r.height) return;
      const pct = ((e.clientY - r.top) / r.height) * 100;
      if (isTop) {
        topPct = Math.max(4, Math.min(botPct - 20, pct));
      } else {
        botPct = Math.min(95, Math.max(topPct + 20, pct));
      }
      updatePositions();
    });
    handleEl.addEventListener('pointerup', () => { dragging = false; });
    handleEl.addEventListener('pointercancel', () => { dragging = false; });
  };

  bindDrag(handlePhigh, true);
  bindDrag(handlePlow, false);
}

// ============================================================================
// INTERACTIVE ENTRY-ZONE, GOLDEN POCKET, AVWAP & VOLUME PROFILE CANVAS ENGINE
// ============================================================================
function renderEntryZoneCanvas(canvas, st) {
  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  const width = Math.max(360, rect.width || 620);
  const height = Math.max(420, rect.height || 580);
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const cur = st.currency === 'EUR' ? '€' : '$';
  const en = st.entry || {};
  const price = st.price || 2.5;
  const dec = price < 1.0 ? 4 : 3;

  const pLow = en.swingLow ?? Number((price * 0.72).toFixed(dec));
  const pHigh = en.swingHigh ?? Number((price * 1.32).toFixed(dec));
  const swingRange = Math.max(0.02, pHigh - pLow);

  const fib382 = Number((pHigh - 0.382 * swingRange).toFixed(dec));
  const fib500 = Number((pHigh - 0.500 * swingRange).toFixed(dec));
  const fib618 = en.fib618 ?? Number((pHigh - 0.618 * swingRange).toFixed(dec));
  const fib786 = en.fib786 ?? Number((pHigh - 0.786 * swingRange).toFixed(dec));
  const fib886Stop = en.fib886Stop ?? Number((pHigh - 0.886 * swingRange).toFixed(dec));

  const avwap = en.avwapAnchor ?? st.vwap ?? price;
  const vpoc = en.vpoc ?? Number(((avwap + price) / 2).toFixed(dec));
  const vah = en.vah ?? Number((vpoc + swingRange * 0.08).toFixed(dec));
  const sma20 = st.sma20 ?? price;
  const sma200 = st.sma200 ?? Number((pLow * 0.96).toFixed(dec));
  const atr = st.atr ?? Number((swingRange * 0.09).toFixed(dec));

  const minPrice = Math.min(pLow, fib886Stop, sma200, price) * 0.94;
  const maxPrice = Math.max(pHigh, price, vah) * 1.05;
  const priceSpan = Math.max(0.05, maxPrice - minPrice);

  // Layout paddings
  const padLeft = 14;
  const padRight = 92; // Price axis + labels
  const padTop = 26;
  const padBottom = 86; // Volume + Squeeze bar
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const yForPrice = (p) => padTop + ((maxPrice - p) / priceSpan) * plotH;
  const priceForY = (y) => maxPrice - ((y - padTop) / plotH) * priceSpan;

  // Deterministic 42-bar OHLCV impulse + pullback structure anchored to real levels
  const numBars = 42;
  const anchorIdx = 8; // Impulse start at P_low
  const peakIdx = 24;  // Impulse peak at P_high
  const bars = [];
  let seed = 0;
  for (let i = 0; i < st.ticker.length; i++) seed += st.ticker.charCodeAt(i) * (i + 1);

  const pseudoRand = (idx) => {
    const x = Math.sin(seed + idx * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };

  let cumTPV = 0;
  let cumVol = 0;

  for (let i = 0; i < numBars; i++) {
    let targetClose;
    if (i < anchorIdx) {
      // Pre-impulse base near P_low
      const t = i / anchorIdx;
      targetClose = pLow * (1.03 - 0.03 * t) + (pseudoRand(i) - 0.5) * atr * 0.4;
    } else if (i === anchorIdx) {
      targetClose = pLow * 1.01;
    } else if (i <= peakIdx) {
      // Strong Leg-1 Impulse from P_low to P_high
      const t = (i - anchorIdx) / (peakIdx - anchorIdx);
      const ease = Math.pow(t, 0.85);
      targetClose = pLow + ease * (pHigh - pLow) + (pseudoRand(i) - 0.48) * atr * 0.55;
    } else if (i < numBars - 1) {
      // Structural Pullback from P_high toward current price (Golden Pocket / AVWAP test)
      const t = (i - peakIdx) / (numBars - 1 - peakIdx);
      const ease = 1 - Math.pow(1 - t, 1.3);
      targetClose = pHigh - ease * (pHigh - price) + (pseudoRand(i) - 0.5) * atr * 0.4;
    } else {
      targetClose = price;
    }

    const prevClose = i > 0 ? bars[i - 1].close : targetClose * 0.99;
    const open = i === numBars - 1 ? Number((price / (1 + (st.change || 0) / 100)).toFixed(dec)) : prevClose;
    const close = Number(targetClose.toFixed(dec));
    const barSpread = atr * (i >= anchorIdx && i <= peakIdx ? 0.85 : 0.48);
    const high = i === peakIdx ? pHigh : Number((Math.max(open, close) + barSpread * (0.3 + 0.5 * pseudoRand(i + 50))).toFixed(dec));
    const low = i === anchorIdx ? pLow : Number((Math.min(open, close) - barSpread * (0.3 + 0.5 * pseudoRand(i + 90))).toFixed(dec));

    // Volume: Spike during impulse (bars 10..24), Volume Dry-Up during pullback (bars 25..41)
    let volMult = 0.55;
    if (i >= anchorIdx && i <= peakIdx) {
      volMult = 1.6 + 1.8 * Math.sin(((i - anchorIdx) / (peakIdx - anchorIdx)) * Math.PI);
    } else if (i > peakIdx) {
      volMult = ((en.pullbackVolRatio || 42) / 100) * (0.75 + 0.4 * pseudoRand(i + 120));
    }
    const vol = Math.round((st.avgVolume || 500000) * volMult);

    // Rolling Anchor-VWAP from anchorIdx
    let barAvwap = null;
    if (i >= anchorIdx) {
      const typ = (high + low + close) / 3;
      cumTPV += typ * vol;
      cumVol += vol;
      barAvwap = cumTPV / cumVol;
    }

    bars.push({ open, high, low, close, vol, avwap: barAvwap });
  }

  // Calibrate Anchor-VWAP curve end to match st.entry.avwapAnchor
  const rawLastAvwap = bars[bars.length - 1].avwap || avwap;
  const avwapScale = avwap / rawLastAvwap;
  for (let i = anchorIdx; i < numBars; i++) {
    const blend = (i - anchorIdx) / (numBars - 1 - anchorIdx);
    bars[i].avwap = bars[i].avwap * (1 + (avwapScale - 1) * blend);
  }

  // Compute Volume-by-Price Profile (20 horizontal price bins)
  const numBins = 20;
  const bins = new Array(numBins).fill(0);
  for (const b of bars) {
    const idx = Math.min(numBins - 1, Math.max(0, Math.floor(((b.close - minPrice) / priceSpan) * numBins)));
    bins[idx] += b.vol;
  }
  // Emphasize VPOC & VAH bin from stock's real entry model
  const vpocBinIdx = Math.min(numBins - 1, Math.max(0, Math.floor(((vpoc - minPrice) / priceSpan) * numBins)));
  bins[vpocBinIdx] = Math.max(...bins) * 1.25;
  const maxBinVol = Math.max(1, ...bins);

  const drawScene = (hoverX = null, hoverY = null) => {
    ctx.clearRect(0, 0, width, height);

    // 1. Background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Subtle horizontal grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= 6; g++) {
      const gy = padTop + (plotH / 6) * g;
      ctx.beginPath();
      ctx.moveTo(padLeft, gy);
      ctx.lineTo(padLeft + plotW, gy);
      ctx.stroke();
    }

    // 2. Shaded Golden Pocket Zone (0.618 to 0.786)
    const y618 = yForPrice(fib618);
    const y786 = yForPrice(fib786);
    const gpGrad = ctx.createLinearGradient(0, y618, 0, y786);
    gpGrad.addColorStop(0, 'rgba(16, 185, 129, 0.24)');
    gpGrad.addColorStop(1, 'rgba(245, 158, 11, 0.22)');
    ctx.fillStyle = gpGrad;
    ctx.fillRect(padLeft, y618, plotW, Math.max(2, y786 - y618));

    // Golden Pocket Borders (0.618 & 0.786)
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(padLeft, y618);
    ctx.lineTo(padLeft + plotW, y618);
    ctx.stroke();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(padLeft, y786);
    ctx.lineTo(padLeft + plotW, y786);
    ctx.stroke();

    // Label inside Golden Pocket
    ctx.fillStyle = 'rgba(16, 185, 129, 0.92)';
    ctx.font = '700 10.5px "JetBrains Mono", monospace';
    ctx.fillText(`🎯 GOLDEN POCKET ENTRY-ZONE (61.8% – 78.6%): ${fib786} – ${fib618} ${cur}`, padLeft + 8, Math.min(y786 - 5, (y618 + y786) / 2 + 4));

    // 3. Invalidation Stop-Loss Zone (< 0.886)
    const y886 = yForPrice(fib886Stop);
    const yLow = yForPrice(pLow);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.13)';
    ctx.fillRect(padLeft, y886, plotW, Math.max(2, Math.min(padTop + plotH, yLow) - y886));

    ctx.save();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, y886);
    ctx.lineTo(padLeft + plotW, y886);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#fca5a5';
    ctx.font = '700 10px "JetBrains Mono", monospace';
    ctx.fillText(`🛑 0.886 INVALIDATION STOP-LOSS: ${fib886Stop} ${cur}`, padLeft + 8, y886 - 5);

    // 4. Impulse Swing Peak (P_high) & Swing Low (P_low) & Fib 38.2 / 50.0
    const drawFibLine = (lvlPrice, label, color, dashed = true) => {
      const y = yForPrice(lvlPrice);
      if (y < padTop - 5 || y > padTop + plotH + 5) return;
      ctx.save();
      if (dashed) ctx.setLineDash([3, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.restore();

      // Right axis tag
      ctx.fillStyle = color;
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.fillText(`${label} ${lvlPrice}`, padLeft + plotW + 4, y + 3);
    };

    drawFibLine(pHigh, 'P_high', '#38bdf8', false);
    drawFibLine(fib382, '38.2%', 'rgba(148,163,184,0.65)', true);
    drawFibLine(fib500, '50.0%', 'rgba(148,163,184,0.65)', true);
    drawFibLine(fib618, '61.8%', '#10b981', false);
    drawFibLine(fib786, '78.6%', '#f59e0b', false);
    drawFibLine(fib886Stop, '88.6%', '#ef4444', false);
    drawFibLine(pLow, 'P_low', '#94a3b8', true);

    // 5. Horizontal Volume-by-Price Profile Histogram (Right side of plot)
    const maxProfileWidth = plotW * 0.24;
    const binH = plotH / numBins;
    for (let b = 0; b < numBins; b++) {
      const binPriceCenter = minPrice + ((b + 0.5) / numBins) * priceSpan;
      const by = yForPrice(binPriceCenter) - binH / 2;
      const bw = (bins[b] / maxBinVol) * maxProfileWidth;
      const isValueArea = binPriceCenter >= fib786 && binPriceCenter <= vah;
      ctx.fillStyle = b === vpocBinIdx
        ? 'rgba(168, 85, 247, 0.45)'
        : isValueArea
          ? 'rgba(56, 189, 248, 0.20)'
          : 'rgba(148, 163, 184, 0.10)';
      ctx.fillRect(padLeft + plotW - bw, by + 1, bw, Math.max(1, binH - 2));
    }

    // VPOC & VAH Horizontal Lines
    const yVpoc = yForPrice(vpoc);
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(padLeft + plotW * 0.55, yVpoc);
    ctx.lineTo(padLeft + plotW, yVpoc);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#c084fc';
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.fillText(`VPOC ${vpoc}`, padLeft + plotW - maxProfileWidth - 62, yVpoc - 3);

    // 6. SMA 200 Structural Trend Line
    if (sma200 >= minPrice && sma200 <= maxPrice) {
      const ySma200 = yForPrice(sma200);
      ctx.save();
      ctx.setLineDash([8, 4]);
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(padLeft, ySma200);
      ctx.lineTo(padLeft + plotW, ySma200);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#fde047';
      ctx.font = '600 9.5px "JetBrains Mono", monospace';
      ctx.fillText(`SMA 200 (${sma200} ${cur})`, padLeft + 8, ySma200 - 4);
    }

    // 7. Candlesticks + Anchor-VWAP Curve + Volume Dry-Up Histogram
    const stepX = plotW / numBars;
    const candleW = Math.max(3, stepX * 0.62);
    const volTop = padTop + plotH + 14;
    const volH = padBottom - 24;
    const maxVol = Math.max(1, ...bars.map((b) => b.vol));

    // Anchor-VWAP - 1sigma Re-Entry Band fill
    ctx.beginPath();
    for (let i = anchorIdx; i < numBars; i++) {
      const cx = padLeft + (i + 0.5) * stepX;
      const yTop = yForPrice(bars[i].avwap);
      if (i === anchorIdx) ctx.moveTo(cx, yTop);
      else ctx.lineTo(cx, yTop);
    }
    for (let i = numBars - 1; i >= anchorIdx; i--) {
      const cx = padLeft + (i + 0.5) * stepX;
      const yBot = yForPrice(bars[i].avwap - 0.5 * atr);
      ctx.lineTo(cx, yBot);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6, 182, 212, 0.14)';
    ctx.fill();

    // Anchor-VWAP Line
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = anchorIdx; i < numBars; i++) {
      const cx = padLeft + (i + 0.5) * stepX;
      const cy = yForPrice(bars[i].avwap);
      if (i === anchorIdx) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Anchor Marker at P_low
    const anchorX = padLeft + (anchorIdx + 0.5) * stepX;
    const anchorY = yForPrice(pLow);
    ctx.fillStyle = '#06b6d4';
    ctx.beginPath();
    ctx.arc(anchorX, anchorY + 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '700 9.5px "JetBrains Mono", monospace';
    ctx.fillText('⚓ AVWAP Anchor (P_low)', anchorX - 18, Math.min(padTop + plotH - 4, anchorY + 16));

    // Draw Candlesticks & Volume Bars
    for (let i = 0; i < numBars; i++) {
      const b = bars[i];
      const cx = padLeft + (i + 0.5) * stepX;
      const isUp = b.close >= b.open;
      const col = isUp ? '#10b981' : '#ef4444';

      // Wick
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(cx, yForPrice(b.high));
      ctx.lineTo(cx, yForPrice(b.low));
      ctx.stroke();

      // Body
      const yOpen = yForPrice(b.open);
      const yClose = yForPrice(b.close);
      const topY = Math.min(yOpen, yClose);
      const bodyH = Math.max(2, Math.abs(yClose - yOpen));
      ctx.fillStyle = col;
      ctx.fillRect(cx - candleW / 2, topY, candleW, bodyH);

      // Volume Bar
      const vh = (b.vol / maxVol) * volH;
      const isPullbackDry = i > peakIdx;
      ctx.fillStyle = isPullbackDry
        ? 'rgba(56, 189, 248, 0.45)'
        : isUp
          ? 'rgba(16, 185, 129, 0.55)'
          : 'rgba(239, 68, 68, 0.45)';
      ctx.fillRect(cx - candleW / 2, volTop + volH - vh, candleW, vh);

      // Squeeze dots along separator line
      if (en.isSqueeze && i >= numBars - 10) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(cx, padTop + plotH + 6, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Volume Dry-Up Annotation
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 9.5px "JetBrains Mono", monospace';
    ctx.fillText(
      `VOLUMEN: Spike (Leg 1) → Pullback Volume Dry-Up (${en.pullbackVolRatio ?? 42}% vom Spike) ${en.isSqueeze ? '• 🗜️ BB/KC SQUEEZE ON' : ''}`,
      padLeft + 8,
      volTop + 10
    );

    // Current Live Price Line & Tag
    const yCur = yForPrice(price);
    ctx.save();
    ctx.setLineDash([2, 2]);
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(padLeft, yCur);
    ctx.lineTo(padLeft + plotW, yCur);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = '#10b981';
    ctx.fillRect(padLeft + plotW + 2, yCur - 9, padRight - 4, 18);
    ctx.fillStyle = '#052e16';
    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillText(`AKT ${price}`, padLeft + plotW + 5, yCur + 3);

    // 8. Interactive Hover Crosshair & Live Fibonacci + CRV Calculator
    if (hoverX != null && hoverY != null && hoverX >= padLeft && hoverX <= padLeft + plotW && hoverY >= padTop && hoverY <= padTop + plotH) {
      const hoverPrice = Number(priceForY(hoverY).toFixed(dec));
      const fibRetracePct = (((pHigh - hoverPrice) / swingRange) * 100).toFixed(1);
      const riskToStop = hoverPrice - fib886Stop;
      const rewardToPeak = pHigh - hoverPrice;
      const liveCrv = riskToStop > 0.005 ? (rewardToPeak / riskToStop).toFixed(2) : '—';

      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padLeft, hoverY);
      ctx.lineTo(padLeft + plotW, hoverY);
      ctx.moveTo(hoverX, padTop);
      ctx.lineTo(hoverX, padTop + plotH);
      ctx.stroke();
      ctx.restore();

      // Hover Tooltip Banner at top-left
      const tipText = `FADENKREUZ: ${hoverPrice} ${cur}  |  Fib-Retracement: ${fibRetracePct}%  |  Stop (0.886): ${fib886Stop} ${cur}  |  Live CRV bis P_high: ${liveCrv} : 1`;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.fillRect(padLeft + 6, padTop + 4, Math.min(plotW - 12, 540), 22);
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(padLeft + 6, padTop + 4, Math.min(plotW - 12, 540), 22);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 10.5px "JetBrains Mono", monospace';
      ctx.fillText(tipText, padLeft + 12, padTop + 18);
    }
  };

  drawScene();

  canvas.onmousemove = (e) => {
    const r = canvas.getBoundingClientRect();
    drawScene(e.clientX - r.left, e.clientY - r.top);
  };
  canvas.onmouseleave = () => {
    drawScene(null, null);
  };
}

// ============================================================================
// TRADINGVIEW PINE SCRIPT V5 GENERATOR (FOR EXTERNAL TRADINGVIEW CHARTS)
// ============================================================================
function generateTradingViewPineScript(st) {
  return `//@version=5
indicator("ALPHA PENNY – Entry-Zonen, Golden Pocket, AVWAP & 100-Pt Confluence (${st.ticker})", shorttitle="ALPHA-ENTRY", overlay=true, max_boxes_count=10, max_lines_count=20)

// === 1. PARAMETER & IMPULS-EINSTELLUNGEN ===
lookback   = input.int(25, "Swing-Impuls Lookback (Kerzen)", minval=5, maxval=120)
bbLength   = input.int(20, "Bollinger / Keltner Periode", minval=5)
bbMult     = input.float(2.0, "Bollinger Multiplikator", step=0.1)
kcMult     = input.float(1.5, "Keltner ATR-Multiplikator", step=0.1)
estSpread  = input.float(${st.entry?.estSpreadPct ?? 0.75}, "Geschätzter Bid-Ask Spread (%)", step=0.1)

// === 2. GOLDEN POCKET FORMEL (0.618 - 0.786 RETEST + 0.886 STOP) ===
p_high     = ta.highest(high, lookback)
p_low      = ta.lowest(low, lookback)
swingRange = math.max(syminfo.mintick, p_high - p_low)

fib_618    = p_high - (0.618 * swingRange)
fib_786    = p_high - (0.786 * swingRange)
stop_886   = p_high - (0.886 * swingRange)
inGolden   = close >= fib_786 * 0.98 and close <= fib_618 * 1.02

// === 3. ROLLING ANCHOR-VWAP & VOLUME PROFILE APPROXIMATION ===
barsSinceLow = math.max(1, ta.barssince(low == p_low))
typPrice     = hlc3
avwap        = ta.vwap(typPrice)
sma20        = ta.sma(close, bbLength)
sma200       = ta.sma(close, 200)
atr20        = ta.atr(bbLength)
avwapLowBand = avwap - (0.5 * atr20)
inAvwapZone  = close >= avwapLowBand and close <= avwap * 1.03

// === 4. BOLLINGER / KELTNER VOLATILITY SQUEEZE ===
dev      = bbMult * ta.stdev(close, bbLength)
bbUpper  = sma20 + dev
bbLower  = sma20 - dev
kcUpper  = sma20 + kcMult * atr20
kcLower  = sma20 - kcMult * atr20
squeezeOn = (bbUpper < kcUpper) and (bbLower > kcLower)
sqTrigger = squeezeOn and close > sma20 and close[1] <= sma20[1]

// === 5. 100-PUNKTE CONFLUENCE SCORING ===
spikeVol    = ta.highest(volume, lookback)
volDryUp    = volume < (0.50 * spikeVol)
ptsTrend    = (close > sma200 or close > p_low * 1.05) ? 25 : 10
ptsZone     = (inGolden or inAvwapZone or squeezeOn) ? 30 : 10
ptsVol      = volDryUp ? 25 : 10
ptsSpread   = estSpread < 1.5 ? 20 : 5
confScore   = ptsTrend + ptsZone + ptsVol + ptsSpread
entryAlert  = confScore >= 80

// === 6. PLOTS IM TRADINGVIEW CHART ===
pHighPlot = plot(p_high, "Swing High (P_high)", color=color.new(#38bdf8, 35), linewidth=1)
p618Plot  = plot(fib_618, "Golden Pocket Top (0.618)", color=color.new(#10b981, 0), linewidth=2)
p786Plot  = plot(fib_786, "Golden Pocket Bottom (0.786)", color=color.new(#f59e0b, 0), linewidth=2)
p886Plot  = plot(stop_886, "Invalidation Stop (0.886)", color=color.new(#ef4444, 0), linewidth=2, style=plot.style_linebr)
plot(avwap, "VWAP / Anchor-VWAP", color=color.new(#06b6d4, 0), linewidth=2)
plot(sma200, "SMA 200", color=color.new(#fde047, 20), linewidth=2)

fill(p618Plot, p786Plot, color=color.new(#10b981, 80), title="Golden Pocket Zone (0.618-0.786)")
bgcolor(squeezeOn ? color.new(#06b6d4, 90) : na, title="BB/KC Squeeze Aktiv")
plotshape(entryAlert and (inGolden or sqTrigger), title="Entry Alert >= 80", style=shape.labelup, location=location.belowbar, color=#10b981, text="ENTRY >=80", textcolor=color.white, size=size.small)

// === 7. LIVE CONFLUENCE SCORECARD TABELLE OBEN RECHTS ===
var table hud = table.new(position.top_right, 2, 6, bgcolor=color.new(#0f172a, 12), border_color=#10b981, border_width=1)
if barstate.islast
    table.cell(hud, 0, 0, "🎯 CONFLUENCE SCORE", text_color=color.white, text_size=size.small)
    table.cell(hud, 1, 0, str.tostring(confScore) + " / 100", text_color=confScore >= 80 ? #10b981 : #f59e0b, text_size=size.small)
    table.cell(hud, 0, 1, "Golden Pocket (0.618-0.786)", text_color=#94a3b8, text_size=size.tiny)
    table.cell(hud, 1, 1, str.tostring(fib_786, "#.###") + " - " + str.tostring(fib_618, "#.###"), text_color=#10b981, text_size=size.tiny)
    table.cell(hud, 0, 2, "Invalidation Stop (0.886)", text_color=#94a3b8, text_size=size.tiny)
    table.cell(hud, 1, 2, str.tostring(stop_886, "#.###"), text_color=#ef4444, text_size=size.tiny)
    table.cell(hud, 0, 3, "BB / Keltner Squeeze", text_color=#94a3b8, text_size=size.tiny)
    table.cell(hud, 1, 3, squeezeOn ? "SQUEEZE ON" : "Expansion", text_color=squeezeOn ? #06b6d4 : #94a3b8, text_size=size.tiny)
    table.cell(hud, 0, 4, "Pullback Volume Dry-Up", text_color=#94a3b8, text_size=size.tiny)
    table.cell(hud, 1, 4, volDryUp ? "JA (<50% Spike)" : "Nein", text_color=volDryUp ? #10b981 : #f59e0b, text_size=size.tiny)
    table.cell(hud, 0, 5, "Signal-Status (>=80)", text_color=#94a3b8, text_size=size.tiny)
    table.cell(hud, 1, 5, entryAlert ? "🎯 ENTRY ALERT!" : "Warte auf Zone", text_color=entryAlert ? #10b981 : color.white, text_size=size.tiny)
`;
}

// ============================================================================
// CSV EXPORT & THEME TOGGLE
// ============================================================================
function exportCurrentToCsv() {
  const headers = [
    'Ticker', 'Name', 'Exchange', 'Region', 'Price', 'Change%', 'RVOL', 'AvgVolume3M',
    'MarketCapM', 'FloatM', 'ForensicScore', 'ConfluenceScore', 'OptEntryLow', 'OptEntryHigh', 'OptStop',
    'CashRunwayMonths', 'DilutionYoY%', 'InsiderOwn%', 'ShortFloat%', 'RevGrowthQoQ%', 'AboveSMA50_200', 'Setups'
  ];
  const lines = [headers.join(',')];
  for (const s of state.filtered) {
    lines.push([
      s.ticker,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      s.exchange,
      s.region,
      s.price,
      s.change,
      s.rvol,
      s.avgVolume,
      s.marketCapM,
      s.floatM,
      s.scores.total,
      s.entry?.confluenceScore ?? '',
      s.entry?.optEntryLow ?? '',
      s.entry?.optEntryHigh ?? '',
      s.entry?.optStop ?? '',
      s.cashRunwayMonths,
      s.dilutionYoY,
      s.insiderOwn,
      s.shortFloat,
      s.revGrowthQoQ ?? '',
      s.aboveSma50 && s.aboveSma200 ? 'YES' : 'NO',
      `"${s.setups.join('|')}"`
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `alpha-penny-screener-${state.activePreset.toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function initThemeToggle() {
  const btn = document.getElementById('btn-theme-toggle');
  btn.addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', next);
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
