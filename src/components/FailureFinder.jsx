import { goodnessColor } from "../eval";

export default function FailureFinder({ result, noun, n_test, n_pos, prevalence }) {
  if (!result || result.slices.length === 0) {
    return (
      <div className="ff-empty">
        Nimic găsit — și asta e lecția. Cu doar <b>{n_pos}</b> {noun} în {n_test.toLocaleString()} rânduri
        (<b>{(prevalence * 100).toFixed(2)}%</b>), nicio subpopulație nu are destule cazuri pozitive pentru un audit fiabil.
        <br />La această rată de bază nici măcar nu poți verifica <i>pe cine</i> ratează modelul. (Comută pe Marketing bancar, unde 11,7% pozitive fac punctele oarbe vizibile.)
      </div>
    );
  }
  const { overallRecall, scanned, slices } = result;
  const scale = Math.max(overallRecall, ...slices.map((s) => s.recall), 0.01);

  return (
    <div className="ff">
      <div className="ff-summary">
        Scanat automat <b>{scanned}</b> subpopulații. Modelul prinde <b>{(overallRecall * 100).toFixed(0)}%</b> din {noun} per total —
        iată unde prinde discret mult mai puține (nu i s-au definit aceste grupuri; căutarea le-a găsit):
      </div>
      <div className="ff-list">
        {slices.map((s, i) => {
          const frac = s.recall / scale;
          return (
            <div className="ff-row" key={i}>
              <div className="ff-rank">{String(i + 1).padStart(2, "0")}</div>
              <div className="ff-desc">{s.label}</div>
              <div className="ff-bar">
                <div className="ff-fill" style={{ width: `${frac * 100}%`, background: goodnessColor(s.recall / overallRecall) }} />
                <div className="ff-mark" style={{ left: `${(overallRecall / scale) * 100}%` }} title="rata medie de prindere" />
              </div>
              <div className="ff-stat tnum">
                <span className="ff-err">prinde {(s.recall * 100).toFixed(0)}%</span>
                <span className="ff-ratio">−{(s.deficit * 100).toFixed(0)} pp</span>
                <span className="ff-n">{s.pos} {noun} · n={s.tot.toLocaleString()} ({((s.tot / n_test) * 100).toFixed(1)}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
