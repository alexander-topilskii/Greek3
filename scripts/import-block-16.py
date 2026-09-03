#!/usr/bin/env python3
"""Import textbook block 16 vocabulary from lexicon into words/ + blocks/16/readme.md."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

PROJECT = Path(__file__).resolve().parent.parent
ROOT = PROJECT / "words"
LEXICON = Path("/Users/aleksandrtopilskii/Documents/projects/Greek/book/pages/lesson_16/lexicon/lexicon.md")
EXISTING_PATH = Path("/tmp/greek3-blocks/existing.json")
BLOCK_N = 16
GROUP = f"Блок {BLOCK_N}"

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
    "προτιμάω": "προτιμώ",
    "σταματώ": "σταματάω",
    "συζητάω": "συζητώ",
    "τραγουδάω": "τραγουδώ",
    "ξεκινάω": "ξεκινώ",
    "γενέθλια": "γενέθλια",
    "ρεσεψιόν": "ρεσεψιόν",
    "ρεσεψшен": "ρεσεψιόν",
}
AORIST_TO_PRESENT = {
    "φύγω": "φεύγω",
    "φύγουμε": "φεύγω",
    "πιω": "πίνω",
    "πιούμε": "πίνω",
    "φάω": "τρώω",
    "φάμε": "τρώω",
    "δω": "βλέπω",
    "δούμε": "βλέπω",
    "πω": "λέω",
    "βγω": "βγαίνω",
    "μπω": "μπαίνω",
    "έρθω": "έρχομαι",
    "καθίσω": "κάθομαι",
    "κάτσω": "κάθομαι",
    "γίνω": "γίνομαι",
    "βρω": "βρίσκω",
    "μάθω": "μαθαίνω",
    "πάρω": "παίρνω",
    "δώσω": "δίνω",
    "βάλω": "βάζω",
    "βγάλω": "βγάζω",
    "πέσω": "πέφτω",
    "πλύνω": "πλένω",
    "φέρω": "φέρνω",
    "μείνω": "μένω",
    "ανεβώ": "ανεβαίνω",
    "κατεβώ": "κατεβαίνω",
    "πληρώσω": "πληρώνω",
    "αγοράσω": "αγοράζω",
    "αλλάξω": "αλλάζω",
    "ανοίξω": "ανοίγω",
    "προσέξω": "προσέχω",
    "φτιάξω": "φτιάχνω",
    "δουλέψω": "δουλεύω",
    "λείψω": "λείπω",
    "γράψω": "γράφω",
    "κλέψω": "κλέβω",
    "μιλήσω": "μιλάω",
    "τηλεφωνήσω": "τηλεφωνώ",
    "διψάσω": "διψάω",
    "πονέσω": "πονάω",
    "καπνίσω": "καπνίζω",
    "καταλάβω": "καταλαβαίνω",
    "στείλω": "στέλνω",
    "χάλασε": "χαλάω",
    "χάσω": "χάνω",
}
PARTICLE_LEMMAS = {
    "δηλαδή", "αμέ", "βέβαια", "εντάξει", "παρακαλώ", "ναι", "όχι", "δεν",
    "αμέσως", "συνήθως", "συχνά", "σπάνια", "τέλεια", "ευγενικά", "ακριβώς",
}
ADVERB_LEMMAS = {
    "νωρίς", "αργά", "αργότερα", "απόψε", "φέτος", "πέρυσι", "αύριο",
    "σήμερα", "χτες", "χθες", "τώρα", "πιο",
}
ADJ_RU_RE = re.compile(
    r"(ый|ий|ой|ая|ое|ые|ие|ный|ский|нный|вшийся|тый|щий)$",
    re.I,
)

SKIP_CATS = {"blocks", "lessons"}


def strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def greek_from_stem(stem: str) -> str:
    """Filename is '{ru} {greek}'; Russian may contain spaces, so take trailing Greek tokens."""
    tokens = stem.replace("·", " · ").split()
    greek_tokens: list[str] = []
    for t in reversed(tokens):
        if GREEK_RE.search(t):
            greek_tokens.append(t)
        elif re.fullmatch(r"[+\-/,·;:!?…()«»*]+", t):
            continue
        elif greek_tokens:
            break
    return " ".join(reversed(greek_tokens))


def scan_existing() -> list[dict]:
    items: list[dict] = []
    for path in ROOT.rglob("*.md"):
        if path.name.lower() == "readme.md":
            continue
        rel = path.relative_to(ROOT).as_posix()
        cat = rel.split("/", 1)[0]
        if cat in SKIP_CATS:
            continue
        stem = path.stem
        gr = greek_from_stem(stem)
        ru = stem[: -len(gr)].strip() if gr and stem.lower().endswith(gr.lower()) else stem
        items.append({
            "rel": rel,
            "gr": gr,
            "gr_low": gr.lower(),
            "name": path.name,
            "ru": ru,
        })
    EXISTING_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXISTING_PATH.write_text(json.dumps(items, ensure_ascii=False), encoding="utf-8")
    return items


EXISTING: list[dict] = []


def find_exact(*needles: str) -> str | None:
    needles_l = [n.lower() for n in needles if n and len(n) >= 2]
    exact_hits: list[str] = []
    token_hits: list[str] = []
    for item in EXISTING:
        gl = item["gr_low"]
        tokens = re.split(r"[\s/·,;]+", gl)
        stem = Path(item["rel"]).stem.lower()
        stem_gr = greek_from_stem(stem) or (stem.split(" ", 1)[-1] if " " in stem else stem)
        stem_tokens = re.split(r"[\s/·,;]+", stem_gr)
        for n in needles_l:
            alts = {n, VARIANTS.get(n, n), AORIST_TO_PRESENT.get(n, n)}
            for a in alts:
                if not a:
                    continue
                if a == gl or a == stem_gr:
                    exact_hits.append(item["rel"])
                elif len(a) >= 3 and " " not in a and (a in tokens or a in stem_tokens):
                    extra = [t for t in stem_tokens if t and t not in ARTICLES and t not in alts]
                    if not extra:
                        token_hits.append(item["rel"])

    def rank(rel: str) -> tuple[int, int]:
        cat = 0 if not rel.startswith("phrases/") else 1
        return (cat, len(Path(rel).stem))

    if exact_hits:
        return sorted(set(exact_hits), key=rank)[0]
    if token_hits:
        return sorted(set(token_hits), key=rank)[0]
    return None


def word_md(translation: str, base_greek: str, forms: list[tuple[str, str]], *, level="A2", topics=None, wtype="", tip=""):
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
    if " · " in g:
        g = g.split(" · ")[0].strip()
    g = re.sub(r"\s*·\s*θα\s*/\s*να\s+", " ", g)
    return g[:80]


def classify(greek: str, russian: str) -> tuple[str, str]:
    g = greek.strip()
    gl = g.lower()
    ru = russian.strip().lower()
    first_chunk = re.split(r"\s*·\s*", g)[0].strip()
    first_tokens = GREEK_RE.findall(first_chunk.lower())
    content_tokens = [t for t in first_tokens if t not in ARTICLES]
    lemma = content_tokens[0] if content_tokens else (first_tokens[0] if first_tokens else gl)
    has_punct = bool(re.search(r"[;!?…]", g))
    multi = len(first_chunk.split()) >= 2

    if lemma in PARTICLE_LEMMAS and not has_punct and len(content_tokens) == 1:
        return "particles", GROUP
    if lemma in ADVERB_LEMMAS and not has_punct and len(content_tokens) == 1:
        return "pronouns", GROUP

    if " · " in g or " / " in g:
        first = re.split(r"\s*[·/]\s*", g)[0].strip().lower()
        first_tok = GREEK_RE.findall(first)
        ft = first_tok[0] if first_tok else first
        if ft.endswith(("ω", "ώ", "ομαι", "ιέμαι", "άμαι", "ούμαι", "έμαι")) or ft in {"είμαι", "έχω", "λέω", "τρώω", "πάω", "ζω"}:
            return "verbs", GROUP
    if lemma.endswith(("ω", "ώ", "ομαι", "ιέμαι", "άμαι", "ούμαι", "έμαι")) and len(content_tokens) == 1 and not has_punct:
        return "verbs", GROUP

    if lemma.endswith(("μός", "μος", "ση", "ξη", "ψη", "μα", "είο", "ειο")) and len(content_tokens) == 1 and not has_punct:
        return "nouns", GROUP

    first_ru = re.split(r"[,;/]", ru)[0].strip().split()[0] if ru else ""
    inflection_only = " · " in g and len(re.split(r"\s*·\s*", g)[0].split()) <= 2
    if lemma.endswith(("μένος", "μένη", "μένο", "ικός", "ική", "ικό", "ινος", "ινη", "ινο")) and not has_punct and (len(content_tokens) == 1 or inflection_only):
        return "adjectives", GROUP
    if ADJ_RU_RE.search(first_ru) and not has_punct and (len(content_tokens) == 1 or inflection_only):
        if not first_ru.endswith(("ние", "ство", "ция", "тие")):
            return "adjectives", GROUP

    if gl.startswith(("το ", "τα ", "η ", "ο ", "οι ")) and len(content_tokens) <= 2 and not has_punct:
        return "nouns", GROUP
    if has_punct or multi:
        return "phrases", GROUP
    if lemma.endswith(("ος", "ός", "η", "ή", "ο", "ό", "ας", "άς", "ης", "ής", "ι", "ί", "ου", "μα", "ση", "ξη", "ψη")):
        return "nouns", GROUP
    if lemma.endswith(("ος", "ός", "η", "ή", "ο", "ό", "ης", "ής", "α", "ά")) and "/" in g:
        return "adjectives", GROUP
    if multi or has_punct:
        return "phrases", GROUP
    return "nouns", GROUP


def primary_lemma(greek: str) -> str | None:
    parts = [p.strip() for p in re.split(r"\s*·\s*", greek)]
    candidate = parts[0]
    candidate = re.sub(r"^θα\s+/?\s*να\s+", "", candidate).strip()
    tokens = [t.lower() for t in GREEK_RE.findall(candidate) if len(t) >= 2]
    if not tokens:
        return None
    if tokens[0] in ARTICLES and len(tokens) > 1:
        lemma = tokens[1]
    else:
        lemma = tokens[0]
    return AORIST_TO_PRESENT.get(lemma, lemma)


def parse_lexicon(text: str) -> list[tuple[str, str, str]]:
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
    tokens = GREEK_RE.findall(gr)
    if cat == "nouns" and tokens and tokens[0].lower() in ARTICLES and len(tokens) > 1:
        gr = " ".join(tokens[1:]) if len(tokens) > 2 else tokens[1]
    elif cat == "verbs":
        if " · " in greek:
            gr = greek.split(" · ")[0].strip()
        gr = GREEK_RE.findall(gr)[0] if GREEK_RE.findall(gr) else gr
        gr = AORIST_TO_PRESENT.get(gr.lower(), gr)
    ru = ru_slug(russian)
    for ch in '/\\:*?"<>|()[]':
        ru = ru.replace(ch, "")
        gr = gr.replace(ch, "")
    ru = re.sub(r"\s+", " ", ru).strip()
    gr = re.sub(r"\s+", " ", gr).strip()
    return f"{ru} {gr}.md"


SECTION_TOPICS = {
    "Прогулка и планы": ["Досуг"],
    "Настроение и разговорные фразы": ["Разговорные"],
    "Урок, класс, планы": ["Учёба"],
    "Конструкции с να": ["Грамматика"],
    "Вопросы и опоры (упражнения)": ["Учёба"],
    "Быт и досуг": ["Быт"],
    "Кино, театр, музыка": ["Досуг"],
    "Жанры и места досуга": ["Досуг"],
    "Ребетика и народная музыка": ["Музыка"],
    "Энтехно и песенная лексика": ["Музыка"],
    "Глаголы: будущее θα и сослагательное να (тип Α)": ["Базовые глаголы"],
    "Глаголы типа Β и отрицание": ["Базовые глаголы"],
    "Хочу vs должен · разрешение": ["Грамматика"],
    "Просьбы и роли": ["Разговорные"],
    "Путешествие и турпакет": ["Путешествия"],
    "Туризм: словарь": ["Путешествия"],
    "Конструкции «нужно / давно не…»": ["Грамматика"],
    "Проблемы дня и подготовка к поездке": ["Путешествия"],
    "Телефонный разговор о планах": ["Разговорные"],
    "Культурная афиша": ["Досуг"],
    "Отель и письмо о поездке": ["Путешествия"],
}


def create_or_resolve(section: str, greek: str, russian: str) -> tuple[str | None, str]:
    lemma = primary_lemma(greek)
    cat, group = classify(greek, russian)
    topics = SECTION_TOPICS.get(section, [GROUP])

    if cat == "phrases":
        fn = make_filename("phrases", greek, russian)
        rel = f"phrases/{fn}"
        path = ROOT / rel
        hit = find_exact(slug_gr(greek))
        if hit and hit.startswith("phrases/") and greek_from_stem(Path(hit).stem).lower() == slug_gr(greek).lower():
            return hit, "reuse"
        if lemma and len(slug_gr(greek).split()) == 1:
            hit = find_exact(lemma)
            if hit:
                return hit, "reuse"
        # constructions like "μπορώ να" — reuse the verb if it exists
        if lemma and slug_gr(greek).lower().endswith(" να") and lemma not in {"έχω", "πρέπει", "μπορεί"}:
            hit = find_exact(lemma)
            if hit and hit.startswith("verbs/"):
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

    if lemma:
        hit = find_exact(lemma)
        if hit:
            stem_gr = greek_from_stem(Path(hit).stem.lower())
            present = AORIST_TO_PRESENT.get(lemma, lemma)
            variants = {lemma, VARIANTS.get(lemma, lemma), present}
            tokens = [t.lower() for t in GREEK_RE.findall(stem_gr)]
            extra = [t for t in tokens if t not in ARTICLES and t not in variants]
            if stem_gr in variants or (tokens and tokens[-1] in variants and not extra):
                return hit, "reuse"

    fn = make_filename(cat, greek, russian)
    rel = f"{cat}/{fn}"
    path = ROOT / rel
    if path.exists():
        return rel, "exists"

    if cat == "verbs":
        parts = [p.strip() for p in re.split(r"\s*·\s*", greek)]
        base = GREEK_RE.findall(parts[0])[0] if GREEK_RE.findall(parts[0]) else parts[0]
        base = AORIST_TO_PRESENT.get(base.lower(), base)
        forms = [(p, russian) for p in parts]
        content = word_md(russian.split("·")[0].strip(), base, forms, topics=topics or ["Базовые глаголы"], wtype="verb", tip="ρήμα")
    elif cat == "adjectives":
        forms = [(p.strip(), russian) for p in re.split(r"\s*[/·]\s*", greek) if p.strip()]
        content = word_md(russian.split("·")[0].strip(), forms[0][0], forms, topics=topics, wtype="adjective", tip="επίθετο")
    elif cat == "particles":
        forms = [(p.strip(), russian) for p in re.split(r"\s*[/·]\s*", greek) if p.strip()]
        content = word_md(russian.split("·")[0].strip(), forms[0][0], forms, topics=topics, wtype="particle")
    elif cat == "pronouns":
        forms = [(p.strip(), russian) for p in re.split(r"\s*[/·]\s*", greek) if p.strip()]
        content = word_md(russian.split("·")[0].strip(), forms[0][0], forms, topics=topics, wtype="pronoun")
    else:
        forms = [(p.strip(), russian) for p in re.split(r"\s*·\s*", greek) if p.strip()]
        content = word_md(russian.split("·")[0].strip(), forms[0][0], forms, topics=topics, wtype="noun", tip="ουσιαστικό")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    ensure_group(ROOT / cat / "readme.md", group, f"[{slug_gr(greek)} — {ru_slug(russian)}]({fn})")
    EXISTING.append({"rel": rel, "gr": slug_gr(greek), "gr_low": slug_gr(greek).lower(), "name": fn, "ru": russian})
    return rel, "created"


def main() -> None:
    global EXISTING
    EXISTING = scan_existing()
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
    out = ROOT / "blocks" / "16" / "readme.md"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"block {BLOCK_N}: {len(items)} links; {stats}; lexicon_rows={len(rows)}")

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
        ok = primary in name or VARIANTS.get(primary, "") in name or AORIST_TO_PRESENT.get(primary, "") in name
        if primary in ARTICLES and len(tokens) > 1:
            ok = tokens[1] in name or VARIANTS.get(tokens[1], "") in name
        if not ok and rel.startswith("verbs/"):
            ok = any(t in name or VARIANTS.get(t, "") in name or AORIST_TO_PRESENT.get(t, "") in name for t in tokens)
        if not ok and rel.startswith("phrases/"):
            ok = any(t in name for t in tokens if len(t) >= 4)
        if not ok:
            suspicious.append((label, rel, primary))
    print("missing", missing)
    print("suspicious", len(suspicious))
    for s in suspicious:
        print(" ", s)


if __name__ == "__main__":
    main()
