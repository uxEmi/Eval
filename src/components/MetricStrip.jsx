import { METRICS, fmtMetric, metricLabel, goodnessColor } from "../eval";

export default function MetricStrip({ metrics, metricKey, setMetricKey, meta }) {
  return (
    <div className="strip">
      {Object.entries(METRICS).map(([k, m]) => {
        const v = m.get(metrics);
        return (
          <div key={k} className={"cell" + (k === metricKey ? " on" : "")} onClick={() => setMetricKey(k)}>
            <span className="k">{metricLabel(k, meta)}</span>
            <span className="v tnum" style={{ color: goodnessColor(m.good(metrics)) }}>{fmtMetric(k, v, meta)}</span>
          </div>
        );
      })}
    </div>
  );
}
