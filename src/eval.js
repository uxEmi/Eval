export const PREV_MIN = 0.001;
export const PREV_MAX = 0.5;
const L0 = Math.log10(PREV_MIN);
const L1 = Math.log10(PREV_MAX);
export const sliderToPrev = (s) => Math.pow(10, L0 + (L1 - L0) * s);
export const prevToSlider = (p) => (Math.log10(p) - L0) / (L1 - L0);

export function confusionAt(data, threshold) {
  const { scores, labels, amounts } = data;
  let tp = 0, fp = 0, tn = 0, fn = 0, missedLoss = 0, caughtLoss = 0;
  for (let i = 0; i < scores.length; i++) {
    const pred = scores[i] >= threshold ? 1 : 0;
    const y = labels[i];
    if (pred === 1 && y === 1) { tp++; caughtLoss += amounts[i]; }
    else if (pred === 1 && y === 0) { fp++; }
    else if (pred === 0 && y === 1) { fn++; missedLoss += amounts[i]; }
    else { tn++; }
  }
  return { tp, fp, tn, fn, missedLoss, caughtLoss };
}

export function rates(conf) {
  const tpr = conf.tp + conf.fn > 0 ? conf.tp / (conf.tp + conf.fn) : 0;
  const fpr = conf.fp + conf.tn > 0 ? conf.fp / (conf.fp + conf.tn) : 0;
  return { tpr, fpr };
}

export const precisionAtPrevalence = (tpr, fpr, pi) => {
  const den = tpr * pi + fpr * (1 - pi);
  return den > 0 ? (tpr * pi) / den : 0;
};
export const accuracyAtPrevalence = (tpr, fpr, pi) => pi * tpr + (1 - pi) * (1 - fpr);

export function doNothingCost(data) {
  let s = 0;
  for (let i = 0; i < data.labels.length; i++) if (data.labels[i] === 1) s += data.amounts[i];
  return s;
}

export function computeMetrics(data, threshold, prevalence, meta, ctx) {
  const conf = confusionAt(data, threshold);
  const { tpr, fpr } = rates(conf);
  const recall = tpr;
  const precision = precisionAtPrevalence(tpr, fpr, prevalence);
  const accuracy = accuracyAtPrevalence(tpr, fpr, prevalence);
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  const falseAlarmCost = meta.false_alarm_cost ?? 3;
  const cost = conf.missedLoss + conf.fp * falseAlarmCost;
  const costGoodness = ctx.doNothing > 0 ? 1 - cost / ctx.doNothing : 0;
  return { conf, tpr, fpr, recall, precision, accuracy, f1, cost, costGoodness, rocAuc: meta.auc };
}

export const METRICS = {
  accuracy:  { label: "Acuratețe",  get: (m) => m.accuracy,  good: (m) => m.accuracy,
               blurb: "din toate tranzacțiile, % clasificate corect" },
  precision: { label: "Precizie", get: (m) => m.precision, good: (m) => m.precision,
               blurb: "din tranzacțiile semnalate, % care sunt cu adevărat pozitive" },
  recall:    { label: "Recall",    get: (m) => m.recall,    good: (m) => m.recall,
               blurb: "din cazurile pozitive reale, % pe care modelul le prinde" },
  f1:        { label: "F1",        get: (m) => m.f1,        good: (m) => m.f1,
               blurb: "media armonică dintre precizie și recall" },
  rocAuc:    { label: "ROC-AUC",   get: (m) => m.rocAuc,    good: (m) => m.rocAuc,
               blurb: "calitatea ordonării — o proprietate reală, fixă a modelului" },
  cost:      { label: "Cost",    get: (m) => m.cost,      good: (m) => m.costGoodness,
               blurb: "pierderi din cazuri ratate + cost de verificare a alarmelor false" },
};

export const fmtMetric = (key, v, meta) =>
  key === "cost"
    ? (meta?.currency ? "$" : "") + Math.round(v).toLocaleString()
    : (v * 100).toFixed(1) + "%";

export const metricLabel = (key, meta) =>
  key === "cost" ? (meta?.cost_label || "Cost") : METRICS[key].label;

export function buildSweep(data, meta, steps = 160) {
  const fa = meta.false_alarm_cost ?? 3;
  const rows = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    const conf = confusionAt(data, t);
    const { tpr, fpr } = rates(conf);
    rows.push({ t, tpr, fpr, fp: conf.fp, missedLoss: conf.missedLoss, cost: conf.missedLoss + conf.fp * fa });
  }
  return rows;
}

export function metricSwing(sweep, metricKey, ctx, prevs) {
  let lo = Infinity, hi = -Infinity;
  for (const r of sweep) {
    for (const pi of prevs) {
      const precision = precisionAtPrevalence(r.tpr, r.fpr, pi);
      const accuracy = accuracyAtPrevalence(r.tpr, r.fpr, pi);
      const recall = r.tpr;
      const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
      const costGoodness = ctx.doNothing > 0 ? 1 - r.cost / ctx.doNothing : 0;
      const m = { precision, accuracy, recall, f1, cost: r.cost, costGoodness, rocAuc: ctx.auc };
      const v = METRICS[metricKey].get(m);
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return { lo, hi };
}

export function metricCurve(sweep, prevalence, ctx) {
  return sweep.map((r) => {
    const recall = r.tpr;
    const precision = precisionAtPrevalence(r.tpr, r.fpr, prevalence);
    const accuracy = accuracyAtPrevalence(r.tpr, r.fpr, prevalence);
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    return { t: r.t, accuracy, precision, recall, f1 };
  });
}

export function argmaxThreshold(curve, key) {
  let best = curve[0];
  for (const row of curve) if (row[key] > best[key]) best = row;
  return best.t;
}

const _fmtNum = (v) =>
  Math.abs(v) >= 100 ? Math.round(v).toLocaleString()
  : Math.abs(v) >= 1 ? v.toFixed(1) : v.toFixed(2);

function sliceCandidates(name, type, col) {
  if (type === "cat") {
    return [...new Set(col)].map((c) => ({ feat: name, label: `${name} = ${c}`, test: (i) => col[i] === c }));
  }
  const sorted = [...col].sort((a, b) => a - b);
  const q = (k) => sorted[Math.floor(k * (sorted.length - 1))];
  const q25 = q(0.25), q75 = q(0.75);
  return [
    { feat: name, label: `${name} ≤ ${_fmtNum(q25)}`, test: (i) => col[i] <= q25 },
    { feat: name, label: `${name} > ${_fmtNum(q75)}`, test: (i) => col[i] > q75 },
  ];
}

export function discoverSlices(data, threshold, { minN = 150, minFrac = 0.005, top = 8, topForPairs = 6 } = {}) {
  const { scores, labels, features } = data;
  const fmeta = data.meta.slice_features || [];
  const n = labels.length;
  if (!features || fmeta.length === 0) return null;

  const pred = new Uint8Array(n);
  let errAll = 0, posAll = 0, tpAll = 0;
  for (let i = 0; i < n; i++) {
    pred[i] = scores[i] >= threshold ? 1 : 0;
    if (pred[i] !== labels[i]) errAll++;
    if (labels[i] === 1) { posAll++; if (pred[i] === 1) tpAll++; }
  }
  const overallErr = errAll / n;
  const overallRecall = posAll > 0 ? tpAll / posAll : 0;
  const minSupport = Math.max(minN, Math.floor(minFrac * n));

  const evalMask = (test) => {
    let tot = 0, err = 0, pos = 0, tp = 0;
    for (let i = 0; i < n; i++) {
      if (!test(i)) continue;
      tot++;
      if (pred[i] !== labels[i]) err++;
      if (labels[i] === 1) { pos++; if (pred[i] === 1) tp++; }
    }
    return { tot, errRate: tot ? err / tot : 0, pos, recall: pos > 0 ? tp / pos : null };
  };

  const minPos = 12;
  const keep = (r) => r.tot >= minSupport && r.pos >= minPos && r.recall != null;

  const singles = [];
  for (const f of fmeta) {
    for (const c of sliceCandidates(f.name, f.type, features[f.name])) {
      const r = evalMask(c.test);
      if (keep(r) && r.recall < overallRecall) singles.push({ ...c, ...r, deficit: overallRecall - r.recall });
    }
  }
  singles.sort((a, b) => b.deficit - a.deficit);

  const pairs = [];
  for (const s of singles.slice(0, topForPairs)) {
    for (const f of fmeta) {
      if (f.name === s.feat) continue;
      for (const sub of sliceCandidates(f.name, f.type, features[f.name])) {
        const test = (i) => s.test(i) && sub.test(i);
        const r = evalMask(test);
        if (keep(r) && r.recall < s.recall) {
          pairs.push({ feat: s.feat, label: `${s.label}  &  ${sub.label}`, ...r, deficit: overallRecall - r.recall });
        }
      }
    }
  }

  const all = [...singles, ...pairs].sort((a, b) => b.deficit - a.deficit);
  const seen = new Set(), picked = [];
  for (const s of all) {
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    picked.push(s);
    if (picked.length >= top) break;
  }
  return { overallErr, overallRecall, scanned: singles.length + pairs.length, slices: picked };
}

let _spare = null;
function gauss() {
  if (_spare !== null) { const s = _spare; _spare = null; return s; }
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const m = Math.sqrt(-2 * Math.log(u));
  _spare = m * Math.sin(2 * Math.PI * v);
  return m * Math.cos(2 * Math.PI * v);
}
function binom(n, p) {
  if (n <= 0) return 0;
  if (n <= 400) { let c = 0; for (let i = 0; i < n; i++) if (Math.random() < p) c++; return c; }
  return Math.max(0, Math.min(n, Math.round(n * p + Math.sqrt(n * p * (1 - p)) * gauss())));
}
const pctile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];

export function metricCI(tpr, fpr, nPos, nNeg, prevalence, metricKey, reps = 400) {
  if (metricKey === "cost" || metricKey === "rocAuc") return null;
  const out = [];
  for (let r = 0; r < reps; r++) {
    const t = nPos > 0 ? binom(nPos, tpr) / nPos : 0;
    const f = nNeg > 0 ? binom(nNeg, fpr) / nNeg : 0;
    const recall = t;
    const precision = precisionAtPrevalence(t, f, prevalence);
    const accuracy = accuracyAtPrevalence(t, f, prevalence);
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    out.push({ accuracy, precision, recall, f1 }[metricKey]);
  }
  out.sort((a, b) => a - b);
  return { lo: pctile(out, 0.025), hi: pctile(out, 0.975) };
}

const ANCHORS = { bad: [178, 58, 38], mid: [154, 117, 28], good: [47, 107, 70] };
const lerp = (a, b, t) => Math.round(a + (b - a) * t);
export function goodnessColor(g) {
  g = Math.max(0, Math.min(1, g));
  const [a, b, t] = g < 0.5
    ? [ANCHORS.bad, ANCHORS.mid, g / 0.5]
    : [ANCHORS.mid, ANCHORS.good, (g - 0.5) / 0.5];
  return `rgb(${lerp(a[0], b[0], t)}, ${lerp(a[1], b[1], t)}, ${lerp(a[2], b[2], t)})`;
}
export function verdictLabel(g) {
  if (g >= 0.8) return "DE LANSAT";
  if (g >= 0.5) return "MARGINAL";
  return "NU LANSA";
}
