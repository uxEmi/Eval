const W = 500, H = 470;
const ML = 104, MR = 24, MT = 86, MB = 24;
const CW = (W - ML - MR) / 2;
const CH = (H - MT - MB) / 2;

function tint(type, n, max) {
  const a = max > 0 ? 0.1 + 0.5 * (Math.log1p(n) / Math.log1p(max)) : 0.1;
  if (type === "fn") return `rgba(178, 58, 38, ${a})`;
  if (type === "tp") return `rgba(47, 107, 70, ${a})`;
  if (type === "fp") return `rgba(154, 117, 28, ${a * 0.85})`;
  return `rgba(108, 100, 82, ${a * 0.5})`;
}

export default function ConfusionGrid({ conf, noun = "pozitive" }) {
  const max = Math.max(conf.tp, conf.fp, conf.tn, conf.fn, 1);
  const cells = [
    { cx: 0, cy: 0, n: conf.tn, type: "tn", label: "Adevărat negativ" },
    { cx: 1, cy: 0, n: conf.fp, type: "fp", label: "Alarmă falsă" },
    { cx: 0, cy: 1, n: conf.fn, type: "fn", label: "Ratate · " + noun },
    { cx: 1, cy: 1, n: conf.tp, type: "tp", label: "Prinse" },
  ];
  return (
    <svg className="cm" viewBox={`0 0 ${W} ${H}`}>
      <text className="cm-axis" x={ML + CW} y={28} textAnchor="middle">PREZIS</text>
      <text className="cm-sub" x={ML + CW / 2} y={66} textAnchor="middle">negativ</text>
      <text className="cm-sub" x={ML + CW + CW / 2} y={66} textAnchor="middle">pozitiv</text>

      <text className="cm-axis" x={28} y={MT + CH} textAnchor="middle" transform={`rotate(-90 28 ${MT + CH})`}>REAL</text>
      <text className="cm-sub" x={ML - 16} y={MT + CH / 2 + 4} textAnchor="end">negativ</text>
      <text className="cm-sub" x={ML - 16} y={MT + CH + CH / 2 + 4} textAnchor="end">pozitiv</text>

      {cells.map((c, i) => {
        const x = ML + c.cx * CW, y = MT + c.cy * CH;
        const isFn = c.type === "fn";
        return (
          <g key={i}>
            <rect x={x} y={y} width={CW} height={CH} fill={tint(c.type, c.n, max)}
                  stroke={isFn ? "var(--alarm)" : "var(--line-2)"} strokeWidth={isFn ? 2 : 1} />
            <text className="cm-count tnum" x={x + CW / 2} y={y + CH / 2} textAnchor="middle"
                  fill={isFn ? "var(--alarm)" : "var(--ink)"}>{c.n.toLocaleString()}</text>
            <text className="cm-label" x={x + CW / 2} y={y + CH - 16} textAnchor="middle"
                  fill={isFn ? "var(--alarm)" : "var(--dim)"}>{c.label}</text>
          </g>
        );
      })}
    </svg>
  );
}
