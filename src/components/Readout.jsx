import { METRICS, fmtMetric, metricLabel, goodnessColor, verdictLabel } from "../eval";

export default function Readout({ metricKey, metrics, meta }) {
  const M = METRICS[metricKey];
  const value = M.get(metrics);
  const good = M.good(metrics);
  const color = goodnessColor(good);
  const label = metricLabel(metricKey, meta);
  const fmt = (v) => fmtMetric(metricKey, v, meta);

  return (
    <div className="panel readout">
      <div className="head"><span>Scor raportat</span></div>
      <div className="stage">
        <div className="metric-name">{label}</div>
        <div className="figure tnum" style={{ color }}>{fmt(value)}</div>
        <div className="verdict" style={{ color }}>{verdictLabel(good)}</div>
      </div>
    </div>
  );
}
