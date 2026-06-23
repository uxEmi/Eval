import { METRICS, metricLabel, sliderToPrev } from "../eval";

export default function ControlBank({ threshold, setThreshold, prevSlider, setPrevSlider, metricKey, setMetricKey, meta }) {
  const prev = sliderToPrev(prevSlider);
  return (
    <div className="panel">
      <div className="head"><span>Controale de evaluare</span></div>

      <div className="ctrl-body">
      <div className="control">
        <div className="row">
          <span className="name">Prag de decizie</span>
          <span className="val tnum">{threshold.toFixed(3)}</span>
        </div>
        <input type="range" min={0} max={1} step={0.001} value={threshold}
               onChange={(e) => setThreshold(parseFloat(e.target.value))} />
      </div>

      <div className="control">
        <div className="row">
          <span className="name">Rata pozitivelor în test</span>
          <span className="val tnum">{(prev * 100).toFixed(prev < 0.01 ? 2 : 1)}%</span>
        </div>
        <input type="range" min={0} max={1} step={0.001} value={prevSlider}
               onChange={(e) => setPrevSlider(parseFloat(e.target.value))} />
      </div>

      <div className="control">
        <div className="row"><span className="name">Metrica principală</span></div>
        <div className="modes">
          {Object.entries(METRICS).map(([k]) => (
            <button key={k} className={k === metricKey ? "on" : ""} onClick={() => setMetricKey(k)}>{metricLabel(k, meta)}</button>
          ))}
        </div>
      </div>
      </div>
    </div>
  );
}
