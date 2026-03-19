import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "./supabaseClient";

// ═══════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════
const mod = (n, m) => ((n % m) + m) % m;
const c99 = (n) => mod(Math.round(n), 100);
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];

// ═══════════════════════════════════════════════════════
//  15 ALGORITHM ENGINES
// ═══════════════════════════════════════════════════════

// 1. Delta Drift — average step extrapolation
function deltaDrift(h) {
  if (h.length < 2) return [];
  const diffs = h.slice(1).map((v, i) => mod(v - h[i], 100));
  const avg = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
  const last = h[h.length - 1];
  return Array.from({ length: 5 }, (_, i) => c99(last + avg * (i + 1)));
}

// 2. Fibonacci Mod — natural growth mod 100
function fibonacci(h) {
  if (h.length < 2) return [];
  let x = h[h.length - 2], y = h[h.length - 1];
  return Array.from({ length: 5 }, () => {
    const next = c99(x + y);
    x = y; y = next; return next;
  });
}

// 3. Markov Chain — historical transition table
function markov(h) {
  if (h.length < 3) return [];
  const trans = {};
  for (let i = 0; i < h.length - 1; i++) {
    if (!trans[h[i]]) trans[h[i]] = {};
    trans[h[i]][h[i + 1]] = (trans[h[i]][h[i + 1]] || 0) + 1;
  }
  let cur = h[h.length - 1];
  return Array.from({ length: 5 }, () => {
    const nexts = trans[cur];
    if (!nexts || !Object.keys(nexts).length) { const n = c99(cur + 1); cur = n; return n; }
    const best = Number(Object.entries(nexts).sort((a, b) => b[1] - a[1])[0][0]);
    cur = best; return best;
  });
}

// 4. Moving Average — mean drift
function movingAvg(h, w = 6) {
  if (h.length < 2) return [];
  const slice = h.slice(-w);
  const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
  const last = h[h.length - 1];
  const drift = c99(avg) - last;
  return Array.from({ length: 5 }, (_, i) => c99(last + Math.round(drift * (i + 1) * 0.5)));
}

// 5. Prime Jump — prime step cycling
function primeJump(h) {
  if (!h.length) return [];
  const last = h[h.length - 1];
  const idx = h.length % PRIMES.length;
  return Array.from({ length: 5 }, (_, i) => c99(last + PRIMES[(idx + i) % PRIMES.length]));
}

// 6. Golden Ratio — phi-based steps
const PHI_STEP = Math.round(100 / 1.6180339887);
function goldenRatio(h) {
  if (!h.length) return [];
  const last = h[h.length - 1];
  return Array.from({ length: 5 }, (_, i) => c99(last + PHI_STEP * (i + 1)));
}

// 7. Geometric Mean — multiplicative attractor
function geoMean(h) {
  if (h.length < 3) return [];
  const vals = h.slice(-6).map((v) => (v === 0 ? 1 : v));
  const gm = Math.round(Math.exp(vals.reduce((a, b) => a + Math.log(b), 0) / vals.length));
  const last = h[h.length - 1];
  const step = c99(gm) - last;
  return Array.from({ length: 5 }, (_, i) => c99(last + step * (i + 1)));
}

// 8. Quadratic — least-squares curve fit
function quadratic(h) {
  if (h.length < 4) return movingAvg(h);
  const pts = h.slice(-4);
  const n = pts.length;
  let sx = 0, sx2 = 0, sx3 = 0, sx4 = 0, sy = 0, sxy = 0, sx2y = 0;
  pts.forEach((y, x) => { sx += x; sx2 += x * x; sx3 += x ** 3; sx4 += x ** 4; sy += y; sxy += x * y; sx2y += x * x * y; });
  const det = n * (sx2 * sx4 - sx3 * sx3) - sx * (sx * sx4 - sx3 * sx2) + sx2 * (sx * sx3 - sx2 * sx2);
  if (Math.abs(det) < 1e-10) return movingAvg(h);
  const a = (sy * (sx2 * sx4 - sx3 * sx3) - sx * (sxy * sx4 - sx2y * sx3) + sx2 * (sxy * sx3 - sx2y * sx2)) / det;
  const b = (n * (sxy * sx4 - sx2y * sx3) - sy * (sx * sx4 - sx3 * sx2) + sx2 * (sx * sx2y - sxy * sx2)) / det;
  const cc = (n * (sx2 * sx2y - sx3 * sxy) - sx * (sx * sx2y - sx3 * sy) + sy * (sx * sx3 - sx2 * sx2)) / det;
  return Array.from({ length: 5 }, (_, i) => c99(a + b * (n + i) + cc * (n + i) ** 2));
}

// 9. Digit Root — digit-sum step size
function digitRoot(h) {
  if (h.length < 2) return [];
  const dRoot = (n) => { let r = Math.abs(n); while (r > 9) r = String(r).split("").reduce((a, b) => a + Number(b), 0); return r || 1; };
  const last = h[h.length - 1];
  const roots = h.slice(-5).map(dRoot);
  const avg = Math.round(roots.reduce((a, b) => a + b, 0) / roots.length);
  return Array.from({ length: 5 }, (_, i) => c99(last + avg * (i + 1)));
}

// 10. Collatz-mod — chaotic cycle mod 100
function collatzMod(h) {
  if (!h.length) return [];
  let v = h[h.length - 1] || 3;
  return Array.from({ length: 5 }, () => { v = v % 2 === 0 ? c99(v / 2) : c99(3 * v + 1); return v; });
}

// 11. EWMA — exponential weighted moving average
function ewma(h, alpha = 0.35) {
  if (h.length < 2) return [];
  let ema = h[0];
  for (let i = 1; i < h.length; i++) ema = alpha * h[i] + (1 - alpha) * ema;
  const last = h[h.length - 1];
  const trend = ema - last;
  return Array.from({ length: 5 }, (_, i) => c99(Math.round(last + trend * (i + 1))));
}

// 12. Hot Frequency — most frequent + recency bias
function hotFrequency(h) {
  if (h.length < 4) return [];
  const freq = {};
  h.forEach((n) => (freq[n] = (freq[n] || 0) + 1));
  h.slice(-15).forEach((n) => (freq[n] = (freq[n] || 0) + 3));
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([n]) => Number(n));
}

// 13. Autocorrelation Lag — best repeating lag
function autocorrelation(h) {
  if (h.length < 6) return [];
  const mean = h.reduce((a, b) => a + b, 0) / h.length;
  let bestLag = 1, bestCorr = -Infinity;
  for (let lag = 1; lag <= Math.min(7, Math.floor(h.length / 2)); lag++) {
    let corr = 0;
    for (let i = lag; i < h.length; i++) corr += (h[i] - mean) * (h[i - lag] - mean);
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }
  const last = h[h.length - 1];
  const lagVal = h[h.length - 1 - bestLag] || last;
  const step = mod(last - lagVal, 100);
  return Array.from({ length: 5 }, (_, i) => c99(last + step * (i + 1)));
}

// 14. Mean Reversion — Bollinger-style reversal
function meanReversion(h) {
  if (h.length < 5) return [];
  const w = h.slice(-12);
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  const std = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length) || 1;
  const last = h[h.length - 1];
  const dir = last > mean ? -1 : 1;
  return Array.from({ length: 5 }, (_, i) => c99(Math.round(mean + dir * std * (i + 1) * 0.6)));
}

// 15. Bayesian — Laplace smoothed probability
function bayesian(h) {
  if (h.length < 3) return [];
  const freq = {};
  h.forEach((n) => (freq[n] = (freq[n] || 0) + 1));
  h.slice(-20).forEach((n) => (freq[n] = (freq[n] || 0) + 2));
  return Object.entries(freq)
    .map(([n, c]) => ({ n: Number(n), p: (c + 1) / (h.length + 100) }))
    .sort((a, b) => b.p - a.p).slice(0, 5).map((x) => x.n);
}

// ═══════════════════════════════════════════════════════
//  ALGORITHM REGISTRY
// ═══════════════════════════════════════════════════════
const ALGORITHMS = [
  { id: "delta",     name: "Δ-Drift",         fn: deltaDrift,     color: "#00ffc8", desc: "Average gap between consecutive numbers, extrapolated forward." },
  { id: "fib",       name: "Fibonacci",        fn: fibonacci,      color: "#ff6b6b", desc: "Adds last two numbers (mod 100) — natural Fibonacci growth." },
  { id: "markov",    name: "Markov Chain",     fn: markov,         color: "#ffd93d", desc: "Learns which number followed each value most often in history." },
  { id: "movavg",   name: "Moving Avg",       fn: movingAvg,      color: "#6bcbff", desc: "Average of last 6 values, predicts where mean is pulling." },
  { id: "prime",     name: "Prime Jump",       fn: primeJump,      color: "#c77dff", desc: "Steps using 2,3,5,7,11... prime increments cyclically." },
  { id: "golden",    name: "Golden Ratio",     fn: goldenRatio,    color: "#ff9f43", desc: "φ=1.618 step — irrational but periodic cycle mod 100." },
  { id: "geomean",   name: "Geo Mean",         fn: geoMean,        color: "#2ed573", desc: "Multiplicative mean attractor — handles non-linear patterns." },
  { id: "quadratic", name: "Quadratic",        fn: quadratic,      color: "#ff4757", desc: "Least-squares ax²+bx+c fit on last 4 points, extrapolates." },
  { id: "digitroot", name: "Digit Root",       fn: digitRoot,      color: "#eccc68", desc: "47→4+7=11→2 — uses reduced digit-sum as step size." },
  { id: "collatz",   name: "Collatz-mod",      fn: collatzMod,     color: "#a29bfe", desc: "If even ÷2, if odd ×3+1 — chaotic but cyclic mod 100." },
  { id: "ewma",      name: "EWMA",             fn: ewma,           color: "#fd79a8", desc: "Exponential smoothing α=0.35 — recent numbers weighted 3× more." },
  { id: "hotfreq",   name: "Hot Numbers",      fn: hotFrequency,   color: "#e17055", desc: "Most frequent numbers with 3× recency bias on last 15 entries." },
  { id: "autocorr",  name: "Autocorrelation",  fn: autocorrelation,color: "#00b894", desc: "Finds best repeating lag (1–7) by cross-correlation analysis." },
  { id: "meanrev",   name: "Mean Reversion",   fn: meanReversion,  color: "#74b9ff", desc: "Bollinger-style — if above mean predicts down, below predicts up." },
  { id: "bayesian",  name: "Bayesian",         fn: bayesian,       color: "#55efc4", desc: "P(n|history) with Laplace smoothing + recency frequency weight." },
];

// ═══════════════════════════════════════════════════════
//  VOTING ENGINE  (weighted votes)
// ═══════════════════════════════════════════════════════
function runVoting(history, weights = {}) {
  const votes = {};
  const algoResults = {};
  ALGORITHMS.forEach(({ id, fn }) => {
    const preds = fn(history);
    const w = Math.max(0.1, weights[id] ?? 1.0);
    algoResults[id] = preds;
    preds.forEach((num, rank) => { votes[num] = (votes[num] || 0) + (5 - rank) * w; });
  });
  const sorted = Object.entries(votes).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([num, score]) => ({ num: Number(num), score }));
  const total = sorted.reduce((a, b) => a + b.score, 0);
  return {
    predictions: sorted.map((p) => ({ ...p, prob: total > 0 ? Math.round((p.score / total) * 100) : 0 })),
    algoResults,
  };
}

// ═══════════════════════════════════════════════════════
//  SELF-TRAINING  (update weights after each new number)
// ═══════════════════════════════════════════════════════
function trainWeights(weights, algoResults, actual) {
  const updated = { ...weights };
  ALGORITHMS.forEach(({ id }) => {
    const preds = algoResults[id] || [];
    const hit = preds.includes(actual);
    const cur = Math.max(0.1, updated[id] ?? 1.0);
    updated[id] = hit ? Math.min(3.0, cur + 0.12 * (1 - cur / 3.0)) : Math.max(0.1, cur - 0.025);
  });
  return updated;
}

// ═══════════════════════════════════════════════════════
//  LOCAL STORAGE FALLBACK
// ═══════════════════════════════════════════════════════
const LS_KEY = "numOracle_v3";
function lsGet() { try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; } }
function lsSet(k, v) { try { const d = lsGet(); d[k] = v; localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} }

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════
const ROWS = ["A", "B", "C"];
const RC = { A: "#00ffc8", B: "#ff9f43", C: "#c77dff" };
const ROW_INFO = { A: "Every 24 hours", B: "3 hrs after A → every 24 hrs", C: "3 hrs after B → every 24 hrs" };
const DEFAULT_API = { url: "", enabled: false };

// ═══════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════
export default function NumberOracle() {
  const [history, setHistory]           = useState({ A: [], B: [], C: [] });
  const [weights, setWeights]           = useState({});
  const [lastAlgoRes, setLastAlgoRes]   = useState({});
  const [predictions, setPredictions]   = useState({});
  const [inputs, setInputs]             = useState({ A: "", B: "", C: "" });
  const [activeRow, setActiveRow]       = useState("A");
  const [apiConfig, setApiConfig]       = useState({ A: { ...DEFAULT_API }, B: { ...DEFAULT_API }, C: { ...DEFAULT_API } });
  const [apiStatus, setApiStatus]       = useState({ A: null, B: null, C: null });
  const [loading, setLoading]           = useState(true);
  const [dbStatus, setDbStatus]         = useState("connecting");
  const [toast, setToast]               = useState(null);
  const [showAlgo, setShowAlgo]         = useState(false);
  const [showApi, setShowApi]           = useState(false);
  const [animKey, setAnimKey]           = useState(0);
  const timers = useRef({});

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  // ── COMPUTE ────────────────────────────────────────────
  const compute = useCallback((hist, w) => {
    const preds = {}, algoRes = {};
    ROWS.forEach((row) => {
      if (hist[row].length >= 2) {
        const { predictions, algoResults } = runVoting(hist[row], w);
        preds[row] = predictions; algoRes[row] = algoResults;
      }
    });
    setPredictions(preds); setLastAlgoRes(algoRes); setAnimKey((k) => k + 1);
  }, []);

  // ── LOAD DATA ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!supabase) {
        const local = lsGet();
        setHistory(local.history || { A: [], B: [], C: [] });
        setWeights(local.weights || {});
        setApiConfig(local.apiConfig || { A: { ...DEFAULT_API }, B: { ...DEFAULT_API }, C: { ...DEFAULT_API } });
        setDbStatus("offline"); setLoading(false); return;
      }
      try {
        const [{ data: hd }, { data: wd }, { data: ad }] = await Promise.all([
          supabase.from("row_history").select("row_name,number").order("created_at", { ascending: true }),
          supabase.from("algo_weights").select("*"),
          supabase.from("api_config").select("*"),
        ]);
        const hist = { A: [], B: [], C: [] };
        (hd || []).forEach(({ row_name, number }) => { if (hist[row_name] !== undefined) hist[row_name].push(number); });
        const w = {};
        (wd || []).forEach(({ algo_name, weight }) => { w[algo_name] = weight; });
        const api = { A: { ...DEFAULT_API }, B: { ...DEFAULT_API }, C: { ...DEFAULT_API } };
        (ad || []).forEach(({ row_name, api_url, enabled }) => { if (api[row_name] !== undefined) api[row_name] = { url: api_url || "", enabled: !!enabled }; });
        setHistory(hist); setWeights(w); setApiConfig(api); setDbStatus("connected");
      } catch (e) {
        console.error(e);
        const local = lsGet();
        setHistory(local.history || { A: [], B: [], C: [] });
        setWeights(local.weights || {});
        setDbStatus("offline");
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => { if (!loading) compute(history, weights); }, [loading]);

  // ── DB SAVE HELPERS ────────────────────────────────────
  const saveNum = useCallback(async (row, num, src) => {
    if (supabase) await supabase.from("row_history").insert({ row_name: row, number: num, source: src });
    const local = lsGet(); local.history = local.history || { A: [], B: [], C: [] };
    local.history[row] = [...(local.history[row] || []), num]; lsSet("history", local.history);
  }, []);

  const saveWeights = useCallback(async (w) => {
    if (supabase) {
      await supabase.from("algo_weights").upsert(
        Object.entries(w).map(([algo_name, weight]) => ({ algo_name, weight, updated_at: new Date().toISOString() })),
        { onConflict: "algo_name" }
      );
    }
    lsSet("weights", w);
  }, []);

  const saveApiCfg = useCallback(async (row, cfg) => {
    if (supabase) await supabase.from("api_config").upsert({ row_name: row, api_url: cfg.url, enabled: cfg.enabled, updated_at: new Date().toISOString() }, { onConflict: "row_name" });
    const local = lsGet(); local.apiConfig = local.apiConfig || {}; local.apiConfig[row] = cfg; lsSet("apiConfig", local.apiConfig);
  }, []);

  // ── ADD NUMBER ─────────────────────────────────────────
  const addNumber = useCallback(async (row, rawVal, src = "manual") => {
    const n = parseInt(rawVal);
    if (isNaN(n) || n < 0 || n > 99) { showToast("Enter a number 0–99", "error"); return false; }
    let newW = weights;
    if (lastAlgoRes[row] && history[row].length >= 2) {
      newW = trainWeights(weights, lastAlgoRes[row], n);
      setWeights(newW); saveWeights(newW);
    }
    const newH = { ...history, [row]: [...history[row], n] };
    setHistory(newH); if (src === "manual") setInputs((p) => ({ ...p, [row]: "" }));
    await saveNum(row, n, src); compute(newH, newW);
    showToast(`${src === "api" ? "🌐 API:" : "✓"} Added ${String(n).padStart(2, "0")} → Row ${row}`);
    return true;
  }, [weights, lastAlgoRes, history, saveNum, saveWeights, compute]);

  // ── API FETCH ──────────────────────────────────────────
  const fetchApi = useCallback(async (row) => {
    const cfg = apiConfig[row];
    if (!cfg?.url) { showToast("Set API URL first", "error"); return; }
    setApiStatus((p) => ({ ...p, [row]: "fetching" }));
    try {
      const res = await fetch(cfg.url, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let num;
      try { const j = JSON.parse(text); num = j.number ?? j.value ?? j.result ?? j.num ?? j.data?.number ?? Object.values(j)[0]; }
      catch { num = parseInt(text.trim()); }
      const p = parseInt(num);
      if (isNaN(p) || p < 0 || p > 99) throw new Error("Response is not a valid 0–99 number");
      const ok = await addNumber(row, p, "api");
      setApiStatus((p2) => ({ ...p2, [row]: ok ? "ok" : "error" }));
    } catch (e) {
      setApiStatus((p) => ({ ...p, [row]: "error" }));
      showToast(`Row ${row} API: ${e.message}`, "error");
    }
  }, [apiConfig, addNumber]);

  // ── POLLING ────────────────────────────────────────────
  useEffect(() => {
    ROWS.forEach((row) => {
      clearInterval(timers.current[row]);
      if (apiConfig[row]?.enabled && apiConfig[row]?.url)
        timers.current[row] = setInterval(() => fetchApi(row), 60_000);
    });
    return () => ROWS.forEach((row) => clearInterval(timers.current[row]));
  }, [apiConfig, fetchApi]);

  // ── CLEAR ROW ──────────────────────────────────────────
  const clearRow = useCallback(async (row) => {
    if (supabase) await supabase.from("row_history").delete().eq("row_name", row);
    const local = lsGet(); if (local.history) { local.history[row] = []; lsSet("history", local.history); }
    const newH = { ...history, [row]: [] }; setHistory(newH); compute(newH, weights);
    showToast(`Row ${row} cleared`, "error");
  }, [history, weights, compute]);

  // ── RESET WEIGHTS ──────────────────────────────────────
  const resetWeights = useCallback(async () => {
    const d = {}; ALGORITHMS.forEach(({ id }) => { d[id] = 1.0; });
    setWeights(d); await saveWeights(d); showToast("Weights reset — fresh training");
  }, [saveWeights]);

  if (loading) {
    return (
      <div style={S.loadScreen}>
        <div style={S.loadIcon}>◈</div>
        <div style={S.loadText}>INITIALIZING ORACLE...</div>
        <div style={S.loadSub}>connecting to cloud database</div>
      </div>
    );
  }

  const ac = RC[activeRow];

  return (
    <div style={S.root}>
      <div style={S.gridBg} />

      {/* TOAST */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === "error" ? "#ff475788" : "#00ffc888" }}>
          {toast.msg}
        </div>
      )}

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.logoWrap}>
          <span style={{ ...S.logoIcon, color: ac }}>◈</span>
          <h1 style={S.logoText}>NUMBER<span style={{ color: ac }}>ORACLE</span></h1>
        </div>
        <p style={S.subtitle}>15 algorithms · voting ensemble · cloud DB · self-training · API fetch</p>
        <div style={S.dbBadge}>
          <span style={{ ...S.dbDot, background: dbStatus === "connected" ? "#00ffc8" : dbStatus === "offline" ? "#ff9f43" : "#555" }} />
          <span style={{ color: dbStatus === "connected" ? "#00ffc8" : "#ff9f43", fontSize: 11, letterSpacing: 1 }}>
            {dbStatus === "connected" ? "☁ Supabase Cloud" : dbStatus === "offline" ? "⚡ Local Storage" : "⟳ Connecting..."}
          </span>
        </div>
      </header>

      {/* TABS */}
      <div style={S.tabs}>
        {ROWS.map((r) => (
          <button key={r} onClick={() => setActiveRow(r)}
            style={{ ...S.tab, ...(activeRow === r ? { borderColor: RC[r], color: RC[r], background: `${RC[r]}10`, boxShadow: `0 0 16px ${RC[r]}20` } : {}) }}>
            ROW {r}
            <span style={{ ...S.tabBadge, background: `${RC[r]}22`, color: RC[r] }}>{history[r].length}</span>
          </button>
        ))}
      </div>

      {/* ACTIVE PANEL */}
      {ROWS.map((row) => activeRow === row && (
        <div key={row} style={S.panel}>

          {/* Row meta bar */}
          <div style={S.rowMeta}>
            <span style={{ ...S.rowBadge, color: ac, borderColor: `${ac}44`, background: `${ac}10` }}>ROW {row}</span>
            <span style={S.rowInfo}>{ROW_INFO[row]}</span>
            <span style={{ ...S.apiIndicator, color: apiStatus[row] === "ok" ? "#00ffc8" : apiStatus[row] === "error" ? "#ff4757" : apiStatus[row] === "fetching" ? "#ffd93d" : "#2a4a3a" }}>
              {apiConfig[row]?.enabled
                ? (apiStatus[row] === "fetching" ? "⟳ API" : apiStatus[row] === "ok" ? "● API" : apiStatus[row] === "error" ? "✕ API" : "○ API on")
                : "○ API off"}
            </span>
          </div>

          {/* History box */}
          <div style={S.histBox}>
            <div style={S.histHeader}>
              <span style={S.histLabel}>HISTORY — {history[row].length} entries</span>
              {history[row].length > 0 && <button style={S.clearBtn} onClick={() => clearRow(row)}>✕ Clear</button>}
            </div>
            <div style={S.histScroll}>
              {history[row].length === 0
                ? <span style={S.emptyMsg}>No data — add manually or enable API auto-fetch</span>
                : history[row].map((n, i) => (
                    <span key={i} style={{ ...S.chip, color: ac, borderColor: `${ac}44` }}>{String(n).padStart(2, "0")}</span>
                  ))}
            </div>
          </div>

          {/* Input row */}
          <div style={S.inputRow}>
            <input type="number" min="0" max="99" value={inputs[row]}
              onChange={(e) => setInputs((p) => ({ ...p, [row]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && addNumber(row, inputs[row])}
              placeholder="00–99"
              style={{ ...S.numInput, borderColor: `${ac}55`, color: ac }}
            />
            <button style={{ ...S.addBtn, borderColor: ac, color: ac, background: `${ac}10` }}
              onClick={() => addNumber(row, inputs[row])}>ADD ↵</button>
            {apiConfig[row]?.url && (
              <button style={S.fetchBtn} onClick={() => fetchApi(row)} title="Fetch from API now">🌐</button>
            )}
          </div>

          {/* Predictions */}
          {predictions[row] ? (
            <div key={`p-${animKey}`} style={S.predSection}>
              <div style={{ ...S.predLabel, color: ac }}>⚡ TOP 5 VOTED PREDICTIONS</div>
              <div style={S.predGrid}>
                {predictions[row].map((p, i) => (
                  <div key={i} style={{ ...S.predCard, borderColor: i === 0 ? ac : "#182a20", background: i === 0 ? `${ac}08` : "#070f0b", animationDelay: `${i * 65}ms` }}>
                    <div style={{ ...S.predRank, color: i === 0 ? ac : "#2a5a3a" }}>{i === 0 ? "★ #1" : `#${i + 1}`}</div>
                    <div style={{ ...S.predNum, color: i === 0 ? ac : "#b0d8c0" }}>{String(p.num).padStart(2, "0")}</div>
                    <div style={S.pBar}><div style={{ ...S.pFill, width: `${p.prob}%`, background: i === 0 ? ac : "#2a4a3a" }} /></div>
                    <div style={{ ...S.pPct, color: i === 0 ? ac : "#3a6a4a" }}>{p.prob}%</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={S.needMore}><span style={{ color: ac }}>◌</span> Add at least 2 numbers to unlock predictions</div>
          )}

          {/* Weights display */}
          {Object.keys(weights).length > 0 && (
            <div style={S.weightsBox}>
              <div style={S.weightsLabel}>🧠 SELF-TRAINED ALGORITHM WEIGHTS</div>
              <div style={S.wGrid}>
                {ALGORITHMS.map(({ id, name, color }) => {
                  const w = weights[id] ?? 1.0;
                  return (
                    <div key={id} style={S.wRow}>
                      <span style={{ color, fontSize: 9, minWidth: 94, letterSpacing: 0.3 }}>{name}</span>
                      <div style={S.wBarBg}><div style={{ ...S.wBarFill, width: `${Math.min(100, (w / 3) * 100)}%`, background: color }} /></div>
                      <span style={{ color: w > 1.1 ? "#00ffc8" : w < 0.7 ? "#ff4757" : "#3a7a5a", fontSize: 9, minWidth: 32 }}>×{w.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
              <button style={S.resetBtn} onClick={resetWeights}>↺ Reset All Weights</button>
            </div>
          )}
        </div>
      ))}

      {/* API CONFIG */}
      <button style={S.sectionBtn} onClick={() => setShowApi((v) => !v)}>
        {showApi ? "▲" : "▼"} API Configuration
      </button>
      {showApi && (
        <div style={S.configBox}>
          <div style={S.configTitle}>🌐 Auto-Fetch API Setup</div>
          <p style={S.configNote}>
            Point each row to any URL that returns a number 0–99.
            Accepts <code style={{ color: "#00ffc8" }}>{"{ number: N }"}</code> JSON or plain text.
            Polls every 60s when enabled. CORS must be open on the target server.
          </p>
          {ROWS.map((row) => (
            <div key={row} style={S.cfgRow}>
              <div style={{ color: RC[row], fontSize: 11, letterSpacing: 2, marginBottom: 8 }}>ROW {row}</div>
              <input type="url" placeholder="https://your-api.com/endpoint"
                value={apiConfig[row]?.url || ""}
                onChange={(e) => setApiConfig((p) => ({ ...p, [row]: { ...p[row], url: e.target.value } }))}
                style={S.urlInput}
              />
              <div style={S.cfgActions}>
                <button
                  style={{ ...S.togglePill, borderColor: RC[row], color: RC[row], background: apiConfig[row]?.enabled ? `${RC[row]}22` : "transparent" }}
                  onClick={() => setApiConfig((p) => ({ ...p, [row]: { ...p[row], enabled: !p[row].enabled } }))}>
                  {apiConfig[row]?.enabled ? "● ON" : "○ OFF"}
                </button>
                <button style={S.cfgSave} onClick={() => { saveApiCfg(row, apiConfig[row]); showToast(`Row ${row} API saved`); }}>SAVE</button>
                <button style={S.cfgTest} onClick={() => fetchApi(row)}>TEST</button>
              </div>
            </div>
          ))}
          <div style={S.apiTip}>
            💡 <strong style={{ color: "#ffd93d" }}>Test API URL (random.org):</strong><br />
            <span style={{ color: "#3a7a5a", fontSize: 10, wordBreak: "break-all" }}>
              https://www.random.org/integers/?num=1&min=0&max=99&col=1&base=10&format=plain&rnd=new
            </span>
          </div>
        </div>
      )}

      {/* ALGO DETAILS */}
      <button style={S.sectionBtn} onClick={() => setShowAlgo((v) => !v)}>
        {showAlgo ? "▲" : "▼"} Algorithm Details (15)
      </button>
      {showAlgo && (
        <div style={S.algoBox}>
          {ALGORITHMS.map(({ id, name, color, desc }) => (
            <div key={id} style={S.algoCard}>
              <div style={{ ...S.algoDot, background: color }} />
              <div style={{ flex: 1 }}>
                <div style={{ ...S.algoName, color }}>{name}</div>
                <div style={S.algoDesc}>{desc}</div>
              </div>
              <div style={{ ...S.algoW, color: (weights[id] ?? 1) > 1.1 ? "#00ffc8" : (weights[id] ?? 1) < 0.7 ? "#ff4757" : "#4a9a7a" }}>
                ×{(weights[id] ?? 1.0).toFixed(2)}
              </div>
            </div>
          ))}
          <div style={S.selfNote}>
            <span style={{ color: "#00ffc8" }}>⟳ Self-Training Engine:</span> Each time you add a number, all 15 algorithms are evaluated — was the actual number in their top-5 prediction? Correct algorithms gain vote weight (up to ×3.0, +0.12 per hit). Incorrect ones lose weight slightly (−0.025 per miss, min ×0.1). Weights are saved to Supabase cloud DB and persist forever. More data = smarter predictions.
          </div>
        </div>
      )}

      <footer style={S.footer}>NumberOracle v3 · 15 Algorithms · Supabase Cloud · Self-Training · API Fetch · 0–99</footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        ::-webkit-scrollbar { height: 3px; width: 3px; background: #060d09; }
        ::-webkit-scrollbar-thumb { background: #1a3a22; border-radius: 2px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.2} }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════
const S = {
  root: { minHeight: "100vh", background: "#04090c", color: "#b8dfc8", fontFamily: "'Share Tech Mono', monospace", paddingBottom: 80, position: "relative", overflowX: "hidden" },
  gridBg: { position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(0,255,200,0.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,200,0.022) 1px,transparent 1px)", backgroundSize: "44px 44px" },
  loadScreen: { minHeight: "100vh", background: "#04090c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, fontFamily: "'Share Tech Mono', monospace" },
  loadIcon: { fontSize: 52, color: "#00ffc8", animation: "pulse 1.2s infinite" },
  loadText: { color: "#00ffc8", fontSize: 16, letterSpacing: 5 },
  loadSub: { color: "#1a3a22", fontSize: 11, letterSpacing: 2 },
  toast: { position: "fixed", top: 14, left: "50%", transform: "translateX(-50%)", padding: "10px 22px", borderRadius: 6, zIndex: 9999, fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#000", fontWeight: 700, letterSpacing: 1, backdropFilter: "blur(12px)", animation: "fadeUp 0.2s ease", whiteSpace: "nowrap" },
  header: { textAlign: "center", padding: "36px 20px 16px", position: "relative", zIndex: 1 },
  logoWrap: { display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 8 },
  logoIcon: { fontSize: 38, animation: "pulse 2.5s infinite" },
  logoText: { fontFamily: "'Orbitron', monospace", fontSize: 28, letterSpacing: 5, color: "#e0ffe8", fontWeight: 900 },
  subtitle: { color: "#2a5a3a", fontSize: 11, letterSpacing: 1.5, marginBottom: 10 },
  dbBadge: { display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid #142a1c", borderRadius: 20, padding: "4px 14px" },
  dbDot: { width: 7, height: 7, borderRadius: "50%", display: "inline-block", animation: "pulse 2s infinite" },
  tabs: { display: "flex", justifyContent: "center", gap: 10, padding: "0 16px 20px", position: "relative", zIndex: 1 },
  tab: { background: "transparent", border: "1px solid #142a1c", color: "#2a5a3a", fontFamily: "'Share Tech Mono', monospace", fontSize: 12, letterSpacing: 2, padding: "10px 20px", cursor: "pointer", borderRadius: 4, display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" },
  tabBadge: { borderRadius: 10, padding: "1px 8px", fontSize: 10 },
  panel: { maxWidth: 620, margin: "0 auto", padding: "0 14px", position: "relative", zIndex: 1 },
  rowMeta: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" },
  rowBadge: { fontFamily: "'Orbitron', monospace", fontSize: 15, padding: "4px 14px", borderRadius: 4, border: "1px solid" },
  rowInfo: { color: "#2a5a3a", fontSize: 10, letterSpacing: 1, flex: 1 },
  apiIndicator: { fontSize: 10, letterSpacing: 1 },
  histBox: { background: "#060d09", border: "1px solid #142a1c", borderRadius: 8, padding: "12px 14px", marginBottom: 12 },
  histHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  histLabel: { color: "#2a5a3a", fontSize: 9, letterSpacing: 2 },
  clearBtn: { background: "transparent", border: "1px solid #ff475733", color: "#ff4757", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, padding: "3px 9px", borderRadius: 3, cursor: "pointer", letterSpacing: 1 },
  histScroll: { display: "flex", flexWrap: "wrap", gap: 5, minHeight: 26, maxHeight: 105, overflowY: "auto", alignContent: "flex-start" },
  chip: { background: "#0a1810", border: "1px solid", padding: "3px 8px", borderRadius: 3, fontSize: 12, letterSpacing: 1, animation: "fadeUp 0.2s ease both" },
  emptyMsg: { color: "#1a3a22", fontSize: 11, alignSelf: "center" },
  inputRow: { display: "flex", gap: 8, marginBottom: 16 },
  numInput: { flex: 1, background: "#060d09", border: "1px solid", fontFamily: "'Share Tech Mono', monospace", fontSize: 22, padding: "10px 14px", borderRadius: 6, outline: "none", textAlign: "center", letterSpacing: 4 },
  addBtn: { fontFamily: "'Share Tech Mono', monospace", fontSize: 11, padding: "10px 16px", borderRadius: 6, cursor: "pointer", letterSpacing: 2, border: "1px solid", transition: "all 0.15s" },
  fetchBtn: { background: "#0a1410", border: "1px solid #1a3a22", color: "#4a9a6a", fontFamily: "'Share Tech Mono', monospace", fontSize: 16, padding: "10px 13px", borderRadius: 6, cursor: "pointer" },
  predSection: { marginBottom: 16 },
  predLabel: { fontSize: 11, letterSpacing: 3, marginBottom: 12 },
  predGrid: { display: "flex", gap: 8, flexWrap: "wrap" },
  predCard: { flex: "1 1 88px", minWidth: 78, border: "1px solid", borderRadius: 8, padding: "12px 8px", textAlign: "center", animation: "fadeUp 0.35s ease both" },
  predRank: { fontSize: 9, letterSpacing: 1, marginBottom: 6 },
  predNum: { fontFamily: "'Orbitron', monospace", fontSize: 26, marginBottom: 8, fontWeight: 700 },
  pBar: { height: 3, background: "#142a1c", borderRadius: 2, marginBottom: 4 },
  pFill: { height: "100%", borderRadius: 2, transition: "width 0.9s ease" },
  pPct: { fontSize: 10 },
  needMore: { textAlign: "center", color: "#1a3a22", fontSize: 11, padding: "24px 0", letterSpacing: 1 },
  weightsBox: { background: "#060d09", border: "1px solid #142a1c", borderRadius: 8, padding: "14px", marginBottom: 16 },
  weightsLabel: { color: "#2a5a3a", fontSize: 9, letterSpacing: 2, marginBottom: 10 },
  wGrid: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 10 },
  wRow: { display: "flex", alignItems: "center", gap: 8 },
  wBarBg: { flex: 1, height: 3, background: "#142a1c", borderRadius: 2 },
  wBarFill: { height: "100%", borderRadius: 2, transition: "width 0.6s ease" },
  resetBtn: { background: "transparent", border: "1px solid #142a1c", color: "#2a5a3a", fontFamily: "'Share Tech Mono', monospace", fontSize: 9, padding: "5px 14px", borderRadius: 4, cursor: "pointer", letterSpacing: 1 },
  sectionBtn: { display: "block", margin: "18px auto 0", background: "transparent", border: "1px solid #142a1c", color: "#2a5a3a", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, letterSpacing: 2, padding: "7px 20px", borderRadius: 4, cursor: "pointer", position: "relative", zIndex: 1 },
  configBox: { maxWidth: 620, margin: "12px auto 0", padding: "0 14px", position: "relative", zIndex: 1 },
  configTitle: { color: "#00ffc8", fontSize: 12, letterSpacing: 2, marginBottom: 8 },
  configNote: { color: "#2a5a3a", fontSize: 10, lineHeight: 1.7, marginBottom: 14, letterSpacing: 0.4 },
  cfgRow: { background: "#060d09", border: "1px solid #142a1c", borderRadius: 6, padding: "12px", marginBottom: 10 },
  urlInput: { width: "100%", background: "#04090c", border: "1px solid #142a1c", color: "#b8dfc8", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, padding: "8px 10px", borderRadius: 4, outline: "none", marginBottom: 8, letterSpacing: 0.4 },
  cfgActions: { display: "flex", gap: 8, alignItems: "center" },
  togglePill: { fontFamily: "'Share Tech Mono', monospace", fontSize: 10, padding: "5px 12px", borderRadius: 4, cursor: "pointer", border: "1px solid", letterSpacing: 1, transition: "all 0.2s" },
  cfgSave: { background: "rgba(0,255,200,0.07)", border: "1px solid #00ffc833", color: "#00ffc8", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, padding: "5px 12px", borderRadius: 4, cursor: "pointer", letterSpacing: 1 },
  cfgTest: { background: "rgba(255,159,67,0.07)", border: "1px solid #ff9f4333", color: "#ff9f43", fontFamily: "'Share Tech Mono', monospace", fontSize: 10, padding: "5px 12px", borderRadius: 4, cursor: "pointer", letterSpacing: 1 },
  apiTip: { background: "#060d09", border: "1px solid #ffd93d18", borderRadius: 6, padding: "12px 14px", fontSize: 11, color: "#3a7a5a", lineHeight: 1.7, marginTop: 4 },
  algoBox: { maxWidth: 620, margin: "12px auto 0", padding: "0 14px", position: "relative", zIndex: 1 },
  algoCard: { display: "flex", alignItems: "flex-start", gap: 12, background: "#060d09", border: "1px solid #142a1c", borderRadius: 6, padding: "10px 12px", marginBottom: 7 },
  algoDot: { width: 8, height: 8, borderRadius: "50%", marginTop: 3, flexShrink: 0 },
  algoName: { fontSize: 11, letterSpacing: 1, marginBottom: 3, fontWeight: 700 },
  algoDesc: { color: "#2a5a3a", fontSize: 10, lineHeight: 1.5, letterSpacing: 0.3 },
  algoW: { fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", paddingTop: 2, minWidth: 38, textAlign: "right" },
  selfNote: { background: "#060d09", border: "1px solid #00ffc810", borderRadius: 6, padding: "14px", fontSize: 10, color: "#2a5a3a", lineHeight: 1.8, letterSpacing: 0.4, marginTop: 4 },
  footer: { textAlign: "center", color: "#142a1c", fontSize: 9, letterSpacing: 2, padding: "48px 20px 0", position: "relative", zIndex: 1 },
};
