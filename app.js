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
    const resp = await fetch('data/pennystocks.json');
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
  const buildChartUrl = (interval = 'D') =>
    `https://s.tradingview.com/widgetembed/?frameElementId=tv_chart&symbol=${encodeURIComponent(tvSymbol)}&interval=${encodeURIComponent(interval)}&hidesidetoolbar=0&withdateranges=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=MASimple%40tv-basicstudies%1FVWAP%40tv-basicstudies%1FRSI%40tv-basicstudies&theme=${themeAttr}&style=1&timezone=Etc%2FUTC`;
  const chartUrl = buildChartUrl('D');

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

    <!-- Interactive Chart Workbench (Full Height + Timeframe & Fullscreen Controls) -->
    <div class="chart-workbench" id="dialog-chart-workbench">
      <div class="chart-toolbar">
        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;">
          <span class="mono" style="font-size:0.76rem;font-weight:700;color:var(--text-secondary);">📈 CHART-ARBEITSPLATZ (${st.exchange}:${st.ticker}):</span>
          <div class="chart-btn-group" role="group" aria-label="Zeiteinheit wählen">
            <button type="button" class="chart-ctrl-btn" data-tv-interval="5">5m</button>
            <button type="button" class="chart-ctrl-btn" data-tv-interval="15">15m</button>
            <button type="button" class="chart-ctrl-btn" data-tv-interval="60">1H</button>
            <button type="button" class="chart-ctrl-btn" data-tv-interval="240">4H</button>
            <button type="button" class="chart-ctrl-btn active" data-tv-interval="D">1T (Tag)</button>
            <button type="button" class="chart-ctrl-btn" data-tv-interval="W">1W (Woche)</button>
          </div>
        </div>

        <div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.5rem;">
          <div class="chart-btn-group" role="group" aria-label="Chart-Größe anpassen">
            <button type="button" class="chart-ctrl-btn" data-chart-size="size-compact">Kompakt (520px)</button>
            <button type="button" class="chart-ctrl-btn active" data-chart-size="size-work">Groß (72% Höhe)</button>
            <button type="button" class="chart-ctrl-btn" data-chart-size="size-max">Maximal (84% Höhe)</button>
          </div>
          <button type="button" class="btn btn-sm btn-primary" id="btn-toggle-chart-fullscreen">
            ⤢ Vollbild-Arbeitsmodus
          </button>
        </div>
      </div>

      <div class="chart-frame size-work" id="dialog-chart-frame">
        <iframe
          id="dialog-tv-iframe"
          title="TradingView Live Chart für ${st.ticker}"
          src="${chartUrl}"
          style="inline-size:100%;block-size:100%;border:0;"
          allowfullscreen>
        </iframe>
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

  bodyEl.querySelectorAll('[data-tv-interval]').forEach((btn) => {
    btn.addEventListener('click', () => {
      bodyEl.querySelectorAll('[data-tv-interval]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (iframeEl) {
        iframeEl.src = buildChartUrl(btn.dataset.tvInterval);
      }
    });
  });

  bodyEl.querySelectorAll('[data-chart-size]').forEach((btn) => {
    btn.addEventListener('click', () => {
      bodyEl.querySelectorAll('[data-chart-size]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (workbenchEl) workbenchEl.classList.remove('is-fullscreen');
      if (fsBtn) fsBtn.textContent = '⤢ Vollbild-Arbeitsmodus';
      if (frameEl) {
        frameEl.style.height = '';
        frameEl.className = `chart-frame ${btn.dataset.chartSize}`;
      }
    });
  });

  if (fsBtn && workbenchEl) {
    fsBtn.addEventListener('click', () => {
      const isFs = workbenchEl.classList.toggle('is-fullscreen');
      fsBtn.textContent = isFs ? '✕ Vollbild beenden' : '⤢ Vollbild-Arbeitsmodus';
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
