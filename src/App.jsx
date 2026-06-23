import { useEffect, useMemo, useState } from "react";
import {
  computeMetrics, doNothingCost, buildSweep, calibration,
  sliderToPrev, prevToSlider, PREV_MIN, PREV_MAX,
} from "./eval";
import ControlBank from "./components/ControlBank";
import Readout from "./components/Readout";
import ConfusionGrid from "./components/ConfusionGrid";
import MetricStrip from "./components/MetricStrip";
import OperatingCurve from "./components/OperatingCurve";
import Calibration from "./components/Calibration";

const BASE = import.meta.env.BASE_URL;

export default function App() {
  const [index, setIndex] = useState(null);
  const [dsKey, setDsKey] = useState(null);
  const [data, setData] = useState(null);
  const [threshold, setThreshold] = useState(0.5);
  const [prevSlider, setPrevSlider] = useState(0);
  const [metricKey, setMetricKey] = useState("accuracy");

  useEffect(() => {
    fetch(BASE + "data/index.json").then((r) => r.json()).then((idx) => {
      setIndex(idx);
      setDsKey(idx[0].key);
    });
  }, []);

  useEffect(() => {
    if (!dsKey) return;
    setData(null);
    fetch(BASE + `data/${dsKey}.json`).then((r) => r.json()).then((d) => {
      setData(d);
      setPrevSlider(prevToSlider(Math.min(Math.max(d.meta.base_prevalence, PREV_MIN), PREV_MAX)));
    });
  }, [dsKey]);

  const ctx = useMemo(() => data ? { doNothing: doNothingCost(data), auc: data.meta.auc } : null, [data]);
  const sweep = useMemo(() => data ? buildSweep(data, data.meta) : null, [data]);
  const calib = useMemo(() => data ? calibration(data) : null, [data]);

  if (!index || !data || !ctx || !sweep || !calib) {
    return <div className="app"><div style={{ padding: 40, color: "var(--dim)", fontFamily: "var(--mono)" }}>se calibrează instrumentul…</div></div>;
  }

  const meta = data.meta;
  const prev = sliderToPrev(prevSlider);
  const metrics = computeMetrics(data, threshold, prev, meta, ctx);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand"><h1 className="mark">Instrumentul<span className="dot">.</span></h1></div>
        <div className="dssel">
          {index.map((d) => (
            <button key={d.key} className={d.key === dsKey ? "on" : ""} onClick={() => setDsKey(d.key)}>
              {d.name} <span className="ds-prev">{(d.base_prevalence * 100).toFixed(d.base_prevalence < 0.01 ? 2 : 1)}%</span>
            </button>
          ))}
        </div>
      </div>

      <div className="console">
        <div className="col">
          <ControlBank
            threshold={threshold} setThreshold={setThreshold}
            prevSlider={prevSlider} setPrevSlider={setPrevSlider}
            metricKey={metricKey} setMetricKey={setMetricKey} meta={meta}
          />
        </div>

        <Readout metricKey={metricKey} metrics={metrics} meta={meta} />

        <div className="col">
          <div className="panel panel-fill">
            <div className="head"><span>Matrice de confuzie</span></div>
            <div className="body"><ConfusionGrid conf={metrics.conf} noun={meta.noun} /></div>
          </div>
        </div>
      </div>

      <MetricStrip metrics={metrics} metricKey={metricKey} setMetricKey={setMetricKey} meta={meta} />

      <div className="opcsection">
        <div className="opc-wrap">
          <OperatingCurve sweep={sweep} prevalence={prev} threshold={threshold} metricKey={metricKey} metrics={metrics} />
        </div>
      </div>

      <div className="section">
        <div className="section-head"><span>Calibrare</span></div>
        <div className="section-body cal-wrap"><Calibration calib={calib} /></div>
      </div>
    </div>
  );
}
