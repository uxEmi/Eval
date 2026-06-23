import { useMemo } from "react";
import { metricCurve } from "../eval";

const W = 1400, H = 300, PL = 46, PR = 26, PT = 22, PB = 40;
const xOf = (t) => PL + t * (W - PL - PR);
const yOf = (v) => PT + (1 - v) * (H - PT - PB);
const BASE = yOf(0);

const LINES = [
  { key: "accuracy", label: "Acuratețe", color: "#9a9079" },
  { key: "precision", label: "Precizie", color: "#9a751c" },
  { key: "recall", label: "Recall", color: "#2c5878" },
  { key: "f1", label: "F1", color: "#2f6b46" },
];

export default function OperatingCurve({ sweep, prevalence, threshold, metricKey, metrics }) {
  const curve = useMemo(() => metricCurve(sweep, prevalence), [sweep, prevalence]);
  const selKey = LINES.some((l) => l.key === metricKey) ? metricKey : null;
  const selColor = LINES.find((l) => l.key === selKey)?.color || "var(--ink)";

  const pts = (key) => curve.map((r) => `${xOf(r.t).toFixed(1)},${yOf(r[key]).toFixed(1)}`);
  const line = (key) => "M" + pts(key).join(" L");
  const area = (key) => `M${xOf(0).toFixed(1)},${BASE} L` + pts(key).join(" L") + ` L${xOf(1).toFixed(1)},${BASE} Z`;

  return (
    <div>
      <svg className="opc" viewBox={`0 0 ${W} ${H}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line className="opc-grid" x1={PL} y1={yOf(v)} x2={W - PR} y2={yOf(v)} />
            <text className="opc-tick" x={PL - 10} y={yOf(v) + 4} textAnchor="end">{v * 100}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} className="opc-tick" x={xOf(t)} y={H - 18} textAnchor="middle">{t.toFixed(2)}</text>
        ))}

        {selKey && <path d={area(selKey)} fill={selColor} opacity="0.12" />}
        {LINES.map((l) => l.key !== selKey && (
          <path key={l.key} d={line(l.key)} fill="none" stroke={l.color} strokeWidth="1.5" opacity="0.3" />
        ))}
        {selKey && <path d={line(selKey)} fill="none" stroke={selColor} strokeWidth="3" />}

        <line className="opc-now" x1={xOf(threshold)} y1={PT - 6} x2={xOf(threshold)} y2={BASE} />
        {LINES.map((l) => (
          <circle key={l.key} cx={xOf(threshold)} cy={yOf(metrics[l.key])} r={l.key === selKey ? 6 : 3.5}
                  fill={l.color} stroke="var(--panel)" strokeWidth="1.5" />
        ))}
      </svg>
      <div className="opc-legend">
        {LINES.map((l) => (
          <span key={l.key} className={l.key === selKey ? "on" : ""}>
            <i style={{ background: l.color }} />{l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
