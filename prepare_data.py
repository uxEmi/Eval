import json
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.datasets import fetch_openml
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, average_precision_score

HERE = Path(__file__).parent
OUTDIR = HERE / "public" / "data"
SEED = 7
CAP_EXPORT = 40000

DATASETS = [
    {
        "key": "creditcard", "data_id": 1597, "name": "Fraudă cu cardul", "noun": "fraude",
        "amount_col": "Amount", "currency": True, "false_alarm_cost": 3.0, "cost_label": "Cost $",
        "blurb": "Tranzacții cu carduri europene, sept. 2013 (ULB). Etichete reale de fraudă.",
        "slice_features": [
            {"raw": "Amount", "name": "Sumă", "type": "num"},
            {"raw": "V14", "name": "V14", "type": "num"},
            {"raw": "V10", "name": "V10", "type": "num"},
            {"raw": "V12", "name": "V12", "type": "num"},
            {"raw": "V4", "name": "V4", "type": "num"},
            {"raw": "V17", "name": "V17", "type": "num"},
            {"raw": "V11", "name": "V11", "type": "num"},
        ],
    },
    {
        "key": "bank", "data_id": 1461, "name": "Marketing bancar", "noun": "abonări",
        "amount_col": None, "currency": False, "false_alarm_cost": 0.2, "cost_label": "Cost (rel.)",
        "blurb": "Apeluri de telemarketing ale unei bănci portugheze (UCI). Țintă = clientul se abonează.",
        "slice_features": [
            {"raw": "V1", "name": "vârstă", "type": "num"},
            {"raw": "V2", "name": "ocupație", "type": "cat"},
            {"raw": "V3", "name": "stare civilă", "type": "cat"},
            {"raw": "V4", "name": "educație", "type": "cat"},
            {"raw": "V6", "name": "sold", "type": "num"},
            {"raw": "V7", "name": "credit imobiliar", "type": "cat"},
            {"raw": "V8", "name": "împrumut", "type": "cat"},
            {"raw": "V9", "name": "contact", "type": "cat"},
            {"raw": "V13", "name": "campanie", "type": "num"},
            {"raw": "V16", "name": "rezultat anterior", "type": "cat"},
        ],
    },
]


def prepare_one(cfg):
    X, y = fetch_openml(data_id=cfg["data_id"], as_frame=True, return_X_y=True, parser="auto")

    pos_label = y.value_counts().idxmin()
    y_bin = (y == pos_label).astype(int).to_numpy()

    if cfg["amount_col"] and cfg["amount_col"] in X.columns:
        amounts = X[cfg["amount_col"]].astype(float).to_numpy()
    else:
        amounts = np.ones(len(X), dtype=float)

    X_enc = pd.get_dummies(X, drop_first=True).fillna(0.0).to_numpy(dtype=float)

    n = len(y_bin)
    idx_tr, idx_te = train_test_split(
        np.arange(n), test_size=0.35, stratify=y_bin, random_state=SEED
    )

    model = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000))
    model.fit(X_enc[idx_tr], y_bin[idx_tr])
    scores_te = model.predict_proba(X_enc[idx_te])[:, 1]
    yte, amt_te = y_bin[idx_te], amounts[idx_te]
    auc = float(roc_auc_score(yte, scores_te))
    pr_auc = float(average_precision_score(yte, scores_te))

    sub = np.arange(len(idx_te))
    if len(sub) > CAP_EXPORT:
        sub, _ = train_test_split(sub, train_size=CAP_EXPORT, stratify=yte, random_state=SEED)
    global_rows = idx_te[sub]

    features, feature_meta = {}, []
    for sf in cfg["slice_features"]:
        col = X[sf["raw"]].iloc[global_rows]
        if sf["type"] == "cat":
            features[sf["name"]] = [str(v) for v in col.tolist()]
        else:
            features[sf["name"]] = [round(float(v), 3) for v in col.tolist()]
        feature_meta.append({"name": sf["name"], "type": sf["type"]})

    fingerprint = hashlib.sha1(
        np.round(model.named_steps["logisticregression"].coef_, 6).tobytes()
    ).hexdigest()[:8]

    payload = {
        "scores": [round(float(v), 5) for v in scores_te[sub]],
        "labels": [int(v) for v in yte[sub]],
        "amounts": [round(float(v), 2) for v in amt_te[sub]],
        "features": features,
        "meta": {
            "key": cfg["key"], "name": cfg["name"], "noun": cfg["noun"], "blurb": cfg["blurb"],
            "source": f"OpenML #{cfg['data_id']} (reale)",
            "model": "LogisticRegression", "fingerprint": fingerprint, "auc": round(auc, 4),
            "pr_auc": round(pr_auc, 4),
            "n_test": int(len(sub)), "n_fraud_test": int(yte[sub].sum()),
            "base_prevalence": round(float(yte[sub].mean()), 5),
            "currency": cfg["currency"], "cost_label": cfg["cost_label"],
            "false_alarm_cost": cfg["false_alarm_cost"], "slice_features": feature_meta,
        },
    }
    return payload


def main():
    OUTDIR.mkdir(parents=True, exist_ok=True)
    old = HERE / "public" / "data.json"
    if old.exists():
        old.unlink()

    index = []
    for cfg in DATASETS:
        print(f"pulling {cfg['name']} (OpenML #{cfg['data_id']}) …")
        payload = prepare_one(cfg)
        (OUTDIR / f"{cfg['key']}.json").write_text(json.dumps(payload))
        m = payload["meta"]
        index.append({k: m[k] for k in
                      ("key", "name", "noun", "blurb", "base_prevalence", "n_test",
                       "n_fraud_test", "auc", "currency", "cost_label")})
        print(f"  {m['name']:20s} test={m['n_test']:>6} pos={m['n_fraud_test']:>4} "
              f"({m['base_prevalence']*100:5.2f}%)  AUC={m['auc']}  #{m['fingerprint']}")

    (OUTDIR / "index.json").write_text(json.dumps(index))
    print(f"wrote {OUTDIR}/index.json with {len(index)} datasets")


if __name__ == "__main__":
    main()
