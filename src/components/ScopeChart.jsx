import { PREV_MIN, PREV_MAX, precisionAtPrevalence } from "../eval";

const W = 360, H = 240, PL = 38, PR = 14, PT = 14, PB = 30;
const L0 = Math.log10(PREV_MIN), L1 = Math.log10(PREV_MAX);
const xOf = (pi) => PL + ((Math.log10(pi) - L0) / (L1 - L0)) * (W - PL - PR);
const yOf = (v) => PT + (1 - v) * (H - PT - PB);

export default function ScopeChart({ tpr, fpr, prevalence }) {
  const pts = [];
  for (let i = 0; i <= 100; i++) {
    const pi = Math.pow(10, L0 + (L1 - L0) * (i / 100));
    pts.push(`${xOf(pi).toFixed(1)},${yOf(precisionAtPrevalence(tpr, fpr, pi)).toFixed(1)}`);
  }
  const curve = "M" + pts.join(" L");
  const xticks = [0.001, 0.01, 0.1, 0.5];
  const yticks = [0, 0.5, 1];
  const curPrec = precisionAtPrevalence(tpr, fpr, prevalence);

  return (
    <div>
      <svg className="scope" viewBox={`0 0 ${W} ${H}`}>
        {yticks.map((v) => (
          <g key={v}>
            <line className="grid-line" x1={PL} y1={yOf(v)} x2={W - PR} y2={yOf(v)} />
            <text x={PL - 6} y={yOf(v) + 3} textAnchor="end">{(v * 100).toFixed(0)}</text>
          </g>
        ))}
        {xticks.map((v) => (
          <text key={v} x={xOf(v)} y={H - 10} textAnchor="middle">{v * 100 + "%"}</text>
        ))}
        <line className="axis-line" x1={PL} y1={PT} x2={PL} y2={H - PB} />
        <line className="axis-line" x1={PL} y1={H - PB} x2={W - PR} y2={H - PB} />
        <line className="flat" x1={PL} y1={yOf(tpr)} x2={W - PR} y2={yOf(tpr)} />
        <path className="curve" d={curve} />
        <circle className="pt-ring" cx={xOf(prevalence)} cy={yOf(curPrec)} r={7} />
        <circle className="pt" cx={xOf(prevalence)} cy={yOf(curPrec)} r={3.5} />
        <text x={W - PR} y={PT + 4} textAnchor="end" fontSize="9">PRECIZIE %</text>
      </svg>
      <div className="legend">
        <span><i style={{ borderColor: "var(--data)" }} />precizie (se mișcă cu rata de bază)</span>
        <span><i style={{ borderColor: "var(--dim-2)", borderTopStyle: "dashed" }} />recall (fix — proprietate a modelului)</span>
      </div>
    </div>
  );
}
