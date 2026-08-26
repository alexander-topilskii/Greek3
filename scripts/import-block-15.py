#!/usr/bin/env python3
"""Import textbook block 15 vocabulary from lexicon into words/ + blocks/15/readme.md."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path("/workspace/words")
LEXICON = Path("/home/ubuntu/.cursor/projects/workspace/uploads/lexicon_58a8.md")
EXISTING = json.loads(Path("/tmp/greek3-blocks/existing.json").read_text(encoding="utf-8"))
BLOCK_N = 15

GREEK_RE = re.compile(r"[\u0370-\u03ff\u1f00-\u1fff]+", re.I)
ARTICLES = {"το", "τα", "η", "ο", "οι", "την", "τον", "του", "της", "τις", "τους", "ένα", "μια", "ένας", "μία"}
VARIANTS = {
    "αδερφός": "αδελφός",
    "αδερφή": "αδελφή",
    "παιδιά": "παιδί",
    "βεβαίως": "βέβαια",
    "χτες": "χθες",
    "προχτές": "προχθές",
    "τραίνο": "τρένο",
    "συγνώμη": "συγγνώμη",
    "καινούριος": "καινούργιος",
    "καινούρια": "καινούργια",
}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def find_exact(*needles: str) -> str | None:
    needles_l = [n.lower() for n in needles if n and len(n) >= 3]
    for item in EXISTING:
        gl = item["gr_low"]
        tokens = re.split(r"[\s/·,;]+", gl)
        stem = Path(item["rel"]).stem.lower()
        stem_gr = stem.split(" ", 1)[-1] if " " in stem else stem
        for n in needles_l:
            alts = {n, VARIANTS.get(n, n)}
            for a in alts:
                if a == gl or a in tokens or a == stem_gr or a in stem_gr.split():
                    return item["rel"]
    return None


def word_md(translation: str, base_greek: str, forms: list[tuple[str, str]], *, level="A1", topics=None, wtype="", tip=""):
    fm = ["---", f"level: {level}"]
    if topics:
        fm.append(f"topics: [{', '.join(topics)}]")
    if wtype:
        fm.append(f"type: {wtype}")
    fm.append("---")
    lines = fm + ["", "# База", f"{translation} : {base_greek}", ""]
    if tip:
        lines += ["# Тип", tip, ""]
    lines.append("# Формы")
    for g, r in forms:
        lines.append(f"{g} - {r}")
    lines.append("")
    return "\n".join(lines)


def ensure_group(readme: Path, group: str, link_line: str) -> None:
    text = readme.read_text(encoding="utf-8") if readme.exists() else f"# {readme.parent.name}\n"
    if link_line in text:
        return
    heading = f"## {group}"
    if heading in text:
        parts = text.split(heading, 1)
        rest = parts[1]
        m = re.search(r"\n## ", rest)
        if m:
            new_rest = rest[: m.start()].rstrip() + "\n" + link_line + "\n" + rest[m.start() :]
        else:
            new_rest = rest.rstrip() + "\n" + link_line + "\n"
        text = parts[0] + heading + new_rest
    else:
        text = text.rstrip() + f"\n\n{heading}\n\n{link_line}\n"
    readme.write_text(text, encoding="utf-8")


def slug_gr(greek: str) -> str:
    g = greek.strip().strip(".;…")
    g = re.sub(r"\s+", " ", g)
    # keep first clause before · for filename if long
    if " · " in g:
        g = g.split(" · ")[0].strip()
    return g[:80]


def classify(greek: str, russian: str) -> tuple[str, str]:
    """Return (category, group)."""
    g = greek.strip()
    gl = g.lower()
    tokens = GREEK_RE.findall(gl)
    has_punct = bool(re.search(r"[;!?…]", g))
    multi = len(g.split()) >= 2 or " · " in g
    if " · " in g or " / " in g:
        first = re.split(r"\s*[·/]\s*", g)[0].strip().lower()
        first_tok = GREEK_RE.findall(first)
        ft = first_tok[0] if first_tok else first
        if ft.endswith(("ω", "ώ", "ομαι", "ιέμαι", "άμαι", "ούμαι", "έμαι")) or ft in {"είμαι", "έχω", "λέω", "τρώω", "πάω", "ζω"}:
            return "verbs", "Блок 15"
    lemma = tokens[0] if tokens else gl
    if lemma.endswith(("ω", "ώ", "ομαι", "ιέμαι", "άμαι", "ούμαι", "έμαι")) and len(tokens) <= 2 and not has_punct:
        return "verbs", "Блок 15"
    if has_punct or (multi and not gl.startswith(("το ", "τα ", "η ", "ο ", "οι ", "τον ", "την ", "του ", "της "))):
        if gl.startswith(("το ", "τα ", "η ", "ο ", "οι ")) and len(tokens) <= 2 and not has_punct:
            return "nouns", "Блок 15"
        return "phrases", "Блок 15"
    if lemma.endswith(("ος", "ός", "η", "ή", "ο", "ό", "ας", "άς", "ης", "ής", "ι", "ί", "ου", "μα", "ση", "ξη", "ψη")) or gl.startswith(("το ", "τα ", "η ", "ο ", "οι ")):
        return "nouns", "Блок 15"
    if lemma.endswith(("ος", "ός", "η", "ή", "ο", "ό", "ης", "ής", "α", "ά")) and "/" in g:
        return "adjectives", "Блок 15"
    if multi or has_punct:
        return "phrases", "Блок 15"
    return "nouns", "Блок 15"


def primary_lemma(greek: str) -> str | None:
    # Prefer present tense before · for verbs
    parts = [p.strip() for p in re.split(r"\s*·\s*", greek)]
    candidate = parts[0]
    # drop leading articles for matching
    tokens = [t.lower() for t in GREEK_RE.findall(candidate) if len(t) >= 2]
    if not tokens:
        return None
    if tokens[0] in ARTICLES and len(tokens) > 1:
        return tokens[1]
    return tokens[0]


def parse_lexicon(text: str) -> list[tuple[str, str, str]]:
    """Return list of (section, greek, russian)."""
    rows: list[tuple[str, str, str]] = []
    section = "Общее"
    for line in text.splitlines():
        if line.startswith("### "):
            section = line[4:].strip()
            continue
        if not line.startswith("|"):
            continue
        cells = [c.strip() for c in line.strip("|").split("|")]
        if len(cells) < 2:
            continue
        el, ru = cells[0], cells[1]
        if el in {"ελληνικά", "----------"} or el.startswith("-"):
            continue
        if not GREEK_RE.search(el):
            continue
        rows.append((section, el, ru))
    return rows


def ru_slug(ru: str) -> str:
    ru = ru.split("·")[0].split("/")[0].split(";")[0].strip()
    ru = re.sub(r"[!?…]+$", "", ru).strip()
    ru = re.sub(r"\s+", " ", ru)
    return ru[:60] or "слово"


def make_filename(cat: str, greek: str, russian: str) -> str:
    gr = slug_gr(greek)
    # strip articles from filename greek part for nouns
    tokens = GREEK_RE.findall(gr)
    if cat == "nouns" and tokens and tokens[0].lower() in ARTICLES and len(tokens) > 1:
        gr = " ".join(tokens[1:]) if len(tokens) > 2 else tokens[1]
    elif cat == "verbs" and " · " in greek:
        gr = greek.split(" · ")[0].strip()
        gr = GREEK_RE.findall(gr)[0] if GREEK_RE.findall(gr) else gr
    ru = ru_slug(russian)
    # sanitize path chars
    for ch in '/\\:*?"<>|()[]':
        ru = ru.replace(ch, "")
        gr = gr.replace(ch, "")
    ru = re.sub(r"\s+", " ", ru).strip()
    gr = re.sub(r"\s+", " ", gr).strip()
    return f"{ru} {gr}.md"


SECTION_TOPICS = {
    "Повторение и задания урока": ["Учёба"],
    "Грамматика: времена и падежи": ["Грамматика"],
    "Глаголы типа Α (наст. · аорист · буд.)": ["Базовые глаголы"],
    "Глаголы типа Β": ["Базовые глаголы"],
    "Частые и неправильные глаголы": ["Базовые глаголы"],
    "Другие глаголы урока": ["Базовые глаголы"],
    "Местоимения (вин. и род.)": ["Местоимения"],
    "Предлоги и наречия места": ["Предлоги"],
    "Город и ориентиры": ["Город"],
    "Кухня и вещи в доме": ["Дом"],
    "Биография и личные данные": ["Биография"],
    "Вождение и парковка": ["Транспорт"],
    "Работа, банк, расписание": ["Работа"],
    "Покупки, еда, мелочи дня": ["Покупки"],
    "Жильё и объявления": ["Жильё"],
    "Сообщения, праздники, приглашения": ["Праздники"],
    "Отдых, остров, природа (без топонимов)": ["Отдых"],
    "Настроение, судьба, здоровье": ["Здоровье"],
    "Люди и занятия (общие слова)": ["Общее"],
}


def create_or_resolve(section: str, greek: str, russian: str) -> tuple[str | None, str]:
    """Return (rel_path, status)."""
    lemma = primary_lemma(greek)
    cat, group = classify(greek, russian)
    topics = SECTION_TOPICS.get(section, ["Блок 15"])

    # Phrases: always create dedicated file (unless exact same phrase exists)
    if cat == "phrases":
        fn = make_filename("phrases", greek, russian)
        rel = f"phrases/{fn}"
        path = ROOT / rel
        # exact match on full greek string in existing
        hit = find_exact(slug_gr(greek))
        if hit and hit.startswith("phrases/") and Path(hit).stem.split(" ", 1)[-1].lower() == slug_gr(greek).lower():
            return hit, "reuse"
        if lemma and len(slug_gr(greek).split()) == 1:
            # single-token "phrase" — try reuse
            hit = find_exact(lemma)
            if hit:
                return hit, "reuse"
        if path.exists():
            return rel, "exists"
        forms = [(p.strip(), russian) for p in re.split(r"\s*·\s*", greek) if p.strip()]
        if not forms:
            forms = [(greek, russian)]
        content = word_md(russian.split("·")[0].strip(), slug_gr(greek), forms, topics=topics, wtype="phrase")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        ensure_group(ROOT / "phrases" / "readme.md", group, f"[{slug_gr(greek)} — {ru_slug(russian)}]({fn})")
        EXISTING.append({"rel": rel, "gr": slug_gr(greek), "gr_low": slug_gr(greek).lower(), "name": fn, "ru": russian})
        return rel, "created"

    # nouns/verbs/adjs: strict reuse on primary lemma
    if lemma:
        hit = find_exact(lemma)
        if hit:
            # only reuse same category-ish, or any if lemma matches stem exactly
            stem = Path(hit).stem.lower()
            if lemma in stem or VARIANTS.get(lemma, "") in stem:
                return hit, "reuse"

    fn = make_filename(cat, greek, russian)
    rel = f"{cat}/{fn}"
    path = ROOT / rel
    if path.exists():
        return rel, "exists"

    if cat == "verbs":
        parts = [p.strip() for p in re.split(r"\s*·\s*", greek)]
        base = parts[0]
        forms = [(p, russian) for p in parts]
        content = word_md(russian.split("·")[0].strip(), base, forms, topics=topics or ["Базовые глаголы"], wtype="verb", tip="ρήμα")
    elif cat == "adjectives":
        forms = [(p.strip(), russian) for p in re.split(r"\s*[/·]\s*", greek) if p.strip()]
        content = word_md(russian.split("·")[0].strip(), forms[0][0], forms, topics=topics, wtype="adjective", tip="επίθετο")
    else:
        forms = [(p.strip(), russian) for p in re.split(r"\s*·\s*", greek) if p.strip()]
        content = word_md(russian.split("·")[0].strip(), forms[0][0], forms, topics=topics, wtype="noun", tip="ουσιαστικό")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    ensure_group(ROOT / cat / "readme.md", group, f"[{slug_gr(greek)} — {ru_slug(russian)}]({fn})")
    EXISTING.append({"rel": rel, "gr": slug_gr(greek), "gr_low": slug_gr(greek).lower(), "name": fn, "ru": russian})
    return rel, "created"


def main() -> None:
    rows = parse_lexicon(LEXICON.read_text(encoding="utf-8"))
    items: list[tuple[str, str]] = []
    seen: set[str] = set()
    stats = {"created": 0, "reuse": 0, "exists": 0, "skip": 0}

    for section, greek, russian in rows:
        label = f"{slug_gr(greek)} — {ru_slug(russian)}"
        rel, status = create_or_resolve(section, greek, russian)
        stats[status] = stats.get(status, 0) + 1
        if not rel:
            print(f"WARN unresolved: {greek}")
            stats["skip"] += 1
            continue
        if rel in seen:
            continue
        seen.add(rel)
        items.append((label, rel))

    lines = [f"# Блок {BLOCK_N}", "", "## Слова", ""]
    for label, rel in items:
        lines.append(f"[{label}](../../{rel})")
    lines.append("")
    out = ROOT / "blocks" / f"{BLOCK_N:02d}" / "readme.md"
    # blocks use 13 not 013 - check existing pattern
    out = ROOT / "blocks" / "15" / "readme.md"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"block {BLOCK_N}: {len(items)} links; {stats}")

    # audit
    suspicious, missing = [], []
    for label, rel in items:
        if not (ROOT / rel).exists():
            missing.append(rel)
            continue
        label_gr = label.split(" — ")[0]
        tokens = [t.lower() for t in GREEK_RE.findall(label_gr) if len(t) >= 3]
        if not tokens:
            continue
        primary = tokens[0]
        name = Path(rel).stem.lower()
        ok = primary in name or VARIANTS.get(primary, "") in name
        if primary in ARTICLES and len(tokens) > 1:
            ok = tokens[1] in name or VARIANTS.get(tokens[1], "") in name
        # allow verb aorist forms linking to present stem files
        if not ok and rel.startswith("verbs/"):
            # if any token in name
            ok = any(t in name or VARIANTS.get(t, "") in name for t in tokens)
        if not ok and rel.startswith("phrases/"):
            # phrase files often use shortened greek; check overlap
            ok = any(t in name for t in tokens if len(t) >= 4)
        if not ok:
            suspicious.append((label, rel, primary))
    print("missing", missing)
    print("suspicious", len(suspicious))
    for s in suspicious[:40]:
        print(" ", s)


if __name__ == "__main__":
    main()
