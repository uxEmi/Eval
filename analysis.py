import json
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "public" / "data"


def load(key):
    return json.loads((DATA / f"{key}.json").read_text())


def confusion(scores, labels, amounts, t, fa_cost):
    tp = fp = tn = fn = 0
    missed = caught = 0.0
    for s, y, a in zip(scores, labels, amounts):
        p = 1 if s >= t else 0
        if p == 1 and y == 1:
            tp += 1; caught += a
        elif p == 1 and y == 0:
            fp += 1
        elif p == 0 and y == 1:
            fn += 1; missed += a
        else:
            tn += 1
    cost = missed + fp * fa_cost
    return dict(tp=tp, fp=fp, tn=tn, fn=fn, missed=missed, cost=cost)


def metrics(c):
    tp, fp, tn, fn = c["tp"], c["fp"], c["tn"], c["fn"]
    n = tp + fp + tn + fn
    acc = (tp + tn) / n if n else 0
    prec = tp / (tp + fp) if tp + fp else 0
    rec = tp / (tp + fn) if tp + fn else 0
    fpr = fp / (fp + tn) if fp + tn else 0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0
    return dict(accuracy=acc, precision=prec, recall=rec, fpr=fpr, f1=f1)


def sweep(d, thresholds):
    fa = d["meta"]["false_alarm_cost"]
    rows = []
    for t in thresholds:
        c = confusion(d["scores"], d["labels"], d["amounts"], t, fa)
        m = metrics(c)
        rows.append((t, c, m))
    return rows


def cost_optimal(d, n=101):
    fa = d["meta"]["false_alarm_cost"]
    best = None
    for i in range(n + 1):
        t = i / n
        c = confusion(d["scores"], d["labels"], d["amounts"], t, fa)
        if best is None or c["cost"] < best[1]["cost"]:
            best = (t, c)
    return best


def discover_slices(d, t, minN=150, minFrac=0.005, minPos=12, top=8, topForPairs=6):
    scores, labels = d["scores"], d["labels"]
    feats = d.get("features", {})
    fmeta = d["meta"].get("slice_features", [])
    n = len(labels)
    pred = [1 if s >= t else 0 for s in scores]
    posAll = sum(labels)
    tpAll = sum(1 for i in range(n) if labels[i] == 1 and pred[i] == 1)
    overall_recall = tpAll / posAll if posAll else 0
    minSupport = max(minN, int(minFrac * n))

    def candidates(name, typ):
        col = feats[name]
        if typ == "cat":
            return [(f"{name} = {c}", (lambda c: (lambda i: col[i] == c))(c)) for c in sorted(set(col))]
        s = sorted(col)
        q25 = s[int(0.25 * (len(s) - 1))]
        q75 = s[int(0.75 * (len(s) - 1))]
        fmt = lambda v: f"{v:,.0f}" if abs(v) >= 100 else (f"{v:.1f}" if abs(v) >= 1 else f"{v:.2f}")
        return [(f"{name} ≤ {fmt(q25)}", lambda i, q=q25: col[i] <= q),
                (f"{name} > {fmt(q75)}", lambda i, q=q75: col[i] > q)]

    def ev(test):
        tot = pos = tp = 0
        for i in range(n):
            if not test(i):
                continue
            tot += 1
            if labels[i] == 1:
                pos += 1
                if pred[i] == 1:
                    tp += 1
        return tot, pos, (tp / pos if pos else None)

    singles = []
    for f in fmeta:
        for label, test in candidates(f["name"], f["type"]):
            tot, pos, rec = ev(test)
            if tot >= minSupport and pos >= minPos and rec is not None and rec < overall_recall:
                singles.append(dict(feat=f["name"], label=label, test=test, tot=tot, pos=pos,
                                    recall=rec, deficit=overall_recall - rec))
    singles.sort(key=lambda s: -s["deficit"])

    pairs = []
    for s in singles[:topForPairs]:
        for f in fmeta:
            if f["name"] == s["feat"]:
                continue
            for label, test in candidates(f["name"], f["type"]):
                comb = (lambda a, b: (lambda i: a(i) and b(i)))(s["test"], test)
                tot, pos, rec = ev(comb)
                if tot >= minSupport and pos >= minPos and rec is not None and rec < s["recall"]:
                    pairs.append(dict(feat=s["feat"], label=f"{s['label']}  &  {label}",
                                      tot=tot, pos=pos, recall=rec, deficit=overall_recall - rec))

    allslc = sorted(singles + pairs, key=lambda s: -s["deficit"])
    seen, picked = set(), []
    for s in allslc:
        if s["label"] in seen:
            continue
        seen.add(s["label"])
        picked.append(s)
        if len(picked) >= top:
            break
    return overall_recall, len(singles) + len(pairs), picked


def pct(x):
    return f"{x*100:.1f}%"


def bp(x):
    return f"{x*100:.2f}%" if x < 0.01 else f"{x*100:.1f}%"


def money(x, currency):
    return ("$" if currency else "") + f"{round(x):,}"


def main():
    cc = load("creditcard")
    bank = load("bank")
    datasets = [cc, bank]
    THRS = [0.1, 0.3, 0.5, 0.7, 0.9]
    out = []
    w = out.append

    w("# Raport de evaluare — un model, mai multe seturi de date, mai multe metrici\n")
    w("Generat automat de `analysis.py` din predicțiile modelului înghețat. "
      "Re-rulează scriptul pentru a regenera raportul cu numere actualizate.\n")

    w("## 1. Setup — ce este fix și ce variază\n")
    w("**Fix:** un singur model (regresie logistică) antrenat o dată per set de date, apoi înghețat. "
      "Modelul produce doar o probabilitate per caz.\n")
    w("**Variabilele tale (pârghiile):** setul de date, pragul de decizie, metrica raportată, subpopulația analizată. "
      "Acest raport arată ce se schimbă când miști fiecare pârghie și **de ce**.\n")

    w("### Seturile de date\n")
    w("| Set | Rânduri (test) | Pozitive | Rată de bază | ROC-AUC |")
    w("|---|---|---|---|---|")
    for d in datasets:
        m = d["meta"]
        w(f"| {m['name']} | {m['n_test']:,} | {m['n_fraud_test']} | {bp(m['base_prevalence'])} | {m['auc']} |")
    w("")

    w("## 2. Pârghia: SETUL DE DATE (aceeași logică, prag 0.5)\n")
    w("Aceleași definiții, același prag (0.5). Doar setul de date diferă.\n")
    w("| Metrică | " + " | ".join(d["meta"]["name"] for d in datasets) + " |")
    w("|---|" + "---|" * len(datasets))
    rows05 = []
    for d in datasets:
        c = confusion(d["scores"], d["labels"], d["amounts"], 0.5, d["meta"]["false_alarm_cost"])
        rows05.append((d, c, metrics(c)))
    for key in ["accuracy", "precision", "recall", "f1"]:
        w(f"| {key} | " + " | ".join(pct(m[key]) for _, _, m in rows05) + " |")
    w(f"| ROC-AUC | " + " | ".join(str(d['meta']['auc']) for d in datasets) + " |")
    w("")
    ccm = rows05[0][2]; bkm = rows05[1][2]
    w("**De ce diferă:**\n")
    w(f"- **Acuratețea** e {pct(ccm['accuracy'])} pe fraudă vs {pct(bkm['accuracy'])} pe bancă — dar pe fraudă e "
      f"înșelătoare: rata de bază e {pct(cc['meta']['base_prevalence'])}, deci un model care spune mereu „nu” e ~99.8% corect "
      "fără să prindă nimic. Acuratețea ridicată reflectă raritatea pozitivelor, nu calitatea modelului.\n")
    w(f"- **Precizia** e {pct(ccm['precision'])} pe fraudă vs {pct(bkm['precision'])} pe bancă. Cauza principală e rata de bază: "
      "când pozitivele sunt extrem de rare (0.17%), chiar și puține alarme false strivesc precizia. Pe bancă (11.7%) "
      "același tip de model are mult mai multe pozitive reale printre cele semnalate.\n")
    w(f"- **Recall** la prag 0.5: {pct(ccm['recall'])} (fraudă) vs {pct(bkm['recall'])} (bancă). La 0.5 modelul de regresie "
      "logistică sub-semnalizează clasa rară; pragul 0.5 nu e neutru când datele sunt dezechilibrate.\n")
    w(f"- **ROC-AUC** ({cc['meta']['auc']} vs {bank['meta']['auc']}) e singura care nu depinde de prag și e relativ stabilă — "
      "măsoară ordonarea, o proprietate a modelului, nu a punctului de operare.\n")

    w("## 3. Pârghia: PRAGUL DE DECIZIE\n")
    for d in datasets:
        m = d["meta"]
        w(f"### {m['name']}\n")
        w("| Prag | Precizie | Recall | F1 | Acuratețe | Alarme false (FP) | Ratări (FN) | Cost |")
        w("|---|---|---|---|---|---|---|---|")
        for t, c, mm in sweep(d, THRS):
            w(f"| {t:.1f} | {pct(mm['precision'])} | {pct(mm['recall'])} | {pct(mm['f1'])} | {pct(mm['accuracy'])} "
              f"| {c['fp']:,} | {c['fn']:,} | {money(c['cost'], m['currency'])} |")
        topt, tc = cost_optimal(d)
        w("")
        w(f"**Prag optim după cost: {topt:.2f}** (cost {money(tc['cost'], m['currency'])}). "
          "Observă că nu e 0.5 — pragul „corect” depinde de ce te costă o ratare vs o alarmă falsă, nu de o valoare implicită.\n")
        w("**De ce:** crescând pragul, modelul semnalează mai puțin → precizia crește dar recall scade (prinzi mai puține "
          "pozitive). Același model, verdict complet diferit, doar mutând linia.\n")

    w("## 4. Pârghia: ALEGEREA METRICII (același model, prag 0.5)\n")
    w("Pe **fraudă**, în funcție de metrica pe care o pui pe slide:\n")
    w(f"- Acuratețe **{pct(ccm['accuracy'])}** → „excelent, de lansat”.")
    w(f"- Recall **{pct(ccm['recall'])}** → „prinde doar jumătate din fraude”.")
    w(f"- Precizie **{pct(ccm['precision'])}** → depinde puternic de rata de bază.\n")
    w("**De ce contează:** niciuna nu e greșită — măsoară lucruri diferite. Cine alege metrica alege concluzia. "
      "De aceea un singur număr fără context e lipsit de sens.\n")

    w("## 5. Pârghia: SUBPOPULAȚIA (unde eșuează modelul, prag 0.5)\n")
    for d in datasets:
        m = d["meta"]
        rec, scanned, slices = discover_slices(d, 0.5)
        w(f"### {m['name']} — recall global {pct(rec)}, scanate {scanned} subpopulații\n")
        if not slices:
            w(f"Nicio subpopulație cu destule pozitive pentru audit fiabil — doar {m['n_fraud_test']} pozitive în total "
              f"({pct(m['base_prevalence'])}). **Lecție:** la rate de bază mici nici nu poți verifica pe cine ratezi.\n")
        else:
            w("| Subpopulație | Recall în grup | Deficit | Pozitive | n |")
            w("|---|---|---|---|---|")
            for s in slices[:6]:
                w(f"| {s['label']} | {pct(s['recall'])} | -{pct(s['deficit'])} | {s['pos']} | {s['tot']:,} |")
            w("")
            w("**De ce contează:** scorul global mediază peste toți. Modelul nu e prost „în medie” — e orb pentru "
              "grupuri specifice, descoperite automat prin căutare, nu specificate de mână.\n")

    w("## 6. Concluzie\n")
    w("Un singur model înghețat poate fi raportat onest ca un succes sau ca un eșec, în funcție doar de pârghiile de "
      "evaluare pe care le alegi: setul de date (rata de bază), pragul, metrica și subpopulația. "
      "Rata de bază (0.17% vs 11.7%) este motivul dominant pentru care aceleași definiții dau numere atât de diferite. "
      "**Un scor nu înseamnă nimic fără să spui cum a fost măsurat.**\n")

    report = "\n".join(out)
    (HERE / "REPORT.md").write_text(report)
    print(f"wrote {HERE / 'REPORT.md'} ({len(report)} chars)")


if __name__ == "__main__":
    main()
