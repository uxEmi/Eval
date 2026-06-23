const S = 300, P = 40;
const xOf = (v) => P + v * (S - 2 * P);
const yOf = (v) => S - P - v * (S - 2 * P);

export default function Calibration({ calib }) {
  const pts = calib.bins.filter((b) => b.n > 0);
  const maxN = Math.max(...pts.map((b) => b.n), 1);
  const linePath = "M" + pts.map((b) => `${xOf(b.meanPred).toFixed(1)},${yOf(b.obs).toFixed(1)}`).join(" L");

  return (
    <div className="cal-card">
      <svg className="cal" viewBox={`0 0 ${S} ${S}`}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line className="cal-grid" x1={xOf(v)} y1={yOf(0)} x2={xOf(v)} y2={yOf(1)} />
            <line className="cal-grid" x1={xOf(0)} y1={yOf(v)} x2={xOf(1)} y2={yOf(v)} />
            <text className="cal-tick" x={xOf(v)} y={yOf(0) + 16} textAnchor="middle">{v}</text>
            <text className="cal-tick" x={xOf(0) - 8} y={yOf(v) + 3} textAnchor="end">{v}</text>
          </g>
        ))}
        <line className="cal-diag" x1={xOf(0)} y1={yOf(0)} x2={xOf(1)} y2={yOf(1)} />
        <path className="cal-line" d={linePath} />
        {pts.map((b, i) => (
          <circle key={i} cx={xOf(b.meanPred)} cy={yOf(b.obs)} r={3 + 5 * (b.n / maxN)}
                  fill="var(--data)" stroke="var(--panel)" strokeWidth="1" />
        ))}
        <text className="cal-axis" x={xOf(0.5)} y={S - 6} textAnchor="middle">PROBABILITATE PREZISĂ</text>
        <text className="cal-axis" x={12} y={yOf(0.5)} textAnchor="middle" transform={`rotate(-90 12 ${yOf(0.5)})`}>RATĂ REALĂ</text>
      </svg>
      <div className="cal-stats">
        <div className="cal-stat"><span className="k">Brier</span><span className="v tnum">{calib.brier.toFixed(4)}</span></div>
        <div className="cal-stat"><span className="k">ECE</span><span className="v tnum">{(calib.ece * 100).toFixed(2)}%</span></div>
      </div>
    </div>
  );
}
