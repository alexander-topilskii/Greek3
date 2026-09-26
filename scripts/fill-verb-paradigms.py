#!/usr/bin/env python3
"""Fill # Спряжение / # Повелительное / # Причастие for words/verbs/*.md.

Uses modern-greek-inflexion (MIT) to draft a paradigm from the present lemma
in «База». A second run rewrites generated sections. The handwritten γίνομαι
paradigm is left untouched. Where «Формы» already list a full person set, those
spellings win. A few library stems are corrected by hand (φταίω, πωλώ, κεράνω).

    pip install modern-greek-inflexion
    python3 scripts/fill-verb-paradigms.py
"""

from __future__ import annotations

import re
import sys
import unicodedata
from pathlib import Path

from modern_greek_inflexion import Verb

ROOT = Path(__file__).resolve().parents[1]
VERBS = ROOT / "words" / "verbs"

SLOTS = (
    ("sg", "pri"),
    ("pl", "pri"),
    ("sg", "sec"),
    ("pl", "sec"),
    ("sg", "ter"),
    ("pl", "ter"),
)

GREEK = re.compile(r"^[\u0370-\u03FF\u1F00-\u1FFF]+$")


def lemma_key(text: str) -> str:
    text = text.strip()
    if not text:
        return text
    return text[0].lower() + text[1:]


def strip_tha(text: str) -> str:
    text = text.strip()
    if text.startswith("θα "):
        return text[3:].strip()
    return text


def parse_base(text: str) -> tuple[str, list[str]]:
    match = re.search(r"^#\s*База\s*\n+(.+)$", text, re.M)
    if not match or ":" not in match.group(1):
        return "", []
    forms = [part.strip() for part in match.group(1).split(":", 1)[1].split("-")]
    forms = [part for part in forms if part]
    if len(forms) >= 3:
        lemma = forms[1]
    elif forms:
        lemma = forms[0]
    else:
        lemma = ""
    return lemma_key(lemma), forms


def penalty(form: str, past: bool = False) -> int:
    score = 0
    for suffix in ("ουνε", "ανε", "μουνα", "σουνα", "τανε", "ντουσαν"):
        if form.endswith(suffix):
            score += 8
    if form.endswith("ομε") or form.endswith("όμε"):
        score += 4
    if form.endswith("σαστε"):
        score += 3
    if past and form.endswith("μαστε") and not form.endswith("μασταν"):
        score += 2
    if not past and form.endswith(("μασταν", "σασταν")):
        score += 3
    # -ησαν is also the normal 3pl of -ησα (πούλησαν). Archaic -ην/-ης/-ημεν/-ητε stay penalized.
    if form.endswith(("ην", "ης", "ημεν", "ητε")):
        score += 12
    return score


def prefix_len(anchor: str, form: str) -> int:
    count = 0
    for left, right in zip(anchor, form):
        if left != right:
            break
        count += 1
    return count


def unique(candidates: list[str]) -> list[str]:
    options: list[str] = []
    for form in candidates:
        if form and form not in options:
            options.append(form)
    return options


def pick_form(candidates: list[str], anchor: str = "", past: bool = False) -> str:
    options = unique(candidates)
    if not options:
        return ""

    def score(form: str) -> tuple:
        return (penalty(form, past), -prefix_len(anchor, form), len(form), form)

    return sorted(options, key=score)[0]


def accent_key(text: str) -> str:
    text = text.replace("ς", "σ")
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(char for char in decomposed if unicodedata.category(char) != "Mn")


def match_spelling(candidates: list[str], wanted: str) -> str:
    wanted = wanted.strip()
    if not wanted:
        return ""
    options = unique(candidates)
    if wanted in options:
        return wanted
    target = accent_key(wanted)
    for form in options:
        if accent_key(form) == target:
            return wanted
    return ""


def as_list(value) -> list[str]:
    if isinstance(value, str):
        return [value] if value and value != "modal" else []
    if isinstance(value, (list, set, tuple)):
        return [item for item in value if isinstance(item, str) and item and item != "modal"]
    return []


def cell(voice_block, number: str, person: str) -> list[str]:
    if not isinstance(voice_block, dict):
        return []
    mood = voice_block.get("ind")
    if not isinstance(mood, dict):
        return []
    number_block = mood.get(number)
    if not isinstance(number_block, dict):
        return []
    return as_list(number_block.get(person))


def choose_voice(lemma: str, tense_block) -> str | None:
    if not isinstance(tense_block, dict):
        return None
    order = ("passive", "active") if lemma.endswith("μαι") else ("active", "passive")
    for voice in order:
        block = tense_block.get(voice)
        if cell(block, "sg", "pri") or cell(block, "sg", "ter"):
            return voice
    return None


def six_forms(
    tense_block,
    voice: str | None,
    forced: str = "",
    past: bool = False,
) -> list[str]:
    block = tense_block.get(voice) if voice and isinstance(tense_block, dict) else None
    raw = {slot: cell(block, slot[0], slot[1]) for slot in SLOTS}
    anchor = match_spelling(raw[("sg", "pri")], forced) or pick_form(raw[("sg", "pri")], past=past)
    anchor_slot = ("sg", "pri")
    if not anchor:
        anchor = match_spelling(raw[("sg", "ter")], forced) or pick_form(raw[("sg", "ter")], past=past)
        anchor_slot = ("sg", "ter")
    result = []
    for slot in SLOTS:
        if slot == anchor_slot:
            result.append(anchor)
        else:
            result.append(pick_form(raw[slot], anchor, past))
    return result


def with_tha(forms: list[str]) -> list[str]:
    return [f"θα {form}" if form else "" for form in forms]


def filled(forms: list[str]) -> bool:
    return any(forms)


def rows(forms: list[str]) -> list[str]:
    pairs = (
        (forms[0], forms[1]),
        (forms[2], forms[3]),
        (forms[4], forms[5]),
    )
    return [f"{left or '—'} | {right or '—'}" for left, right in pairs]


def nonfinite(data: dict, lemma: str, forced: str = "") -> str:
    conjunctive = data.get("conjunctive") or {}
    aorist_voice = choose_voice(lemma, data.get("aorist") or {})
    order = ["active", "passive"]
    if lemma.endswith("μαι"):
        order = ["passive", "active"]
    if aorist_voice:
        order = [aorist_voice] + [voice for voice in order if voice != aorist_voice]
    for voice in order:
        forms = six_forms(conjunctive, voice, forced if voice == aorist_voice else "")
        if forms[4]:
            return forms[4]
    return ""


def perfect_rows(aux: list[str], stem: str, modal: bool) -> list[str]:
    forms = []
    for index, helper in enumerate(aux):
        person = SLOTS[index]
        if modal and person != ("sg", "ter"):
            forms.append("")
        elif stem:
            forms.append(f"{helper} {stem}")
        else:
            forms.append("")
    return forms


def imperative_pair(tense_block, voice: str | None) -> tuple[str, str] | None:
    if not voice or not isinstance(tense_block, dict):
        return None
    block = tense_block.get(voice)
    if not isinstance(block, dict):
        return None
    mood = block.get("imp")
    if not isinstance(mood, dict):
        return None
    singular = as_list((mood.get("sg") or {}).get("sec"))
    plural = as_list((mood.get("pl") or {}).get("sec"))
    if not singular and not plural:
        return None
    anchor = pick_form(singular)
    return anchor, pick_form(plural, anchor)


def participle_line(label: str, masculine: str, feminine: set[str], neuter: set[str]) -> str:
    if masculine.endswith("ος"):
        stem = masculine[:-2]
        if f"{stem}η" in feminine and f"{stem}ο" in neuter:
            return f"{label}: {masculine}, -η, -ο"
    return f"{label}: {masculine}"


def gendered(participles: dict, key: str) -> str:
    tree = participles.get(key)
    if not isinstance(tree, dict):
        return ""
    try:
        masculine = as_list(tree["sg"]["masc"]["nom"])
        feminine = set(as_list(tree["sg"]["fem"]["nom"]))
        neuter = set(as_list(tree["sg"]["neut"]["nom"]))
    except (KeyError, TypeError):
        return ""
    chosen = pick_form(masculine)
    if not chosen:
        return ""
    label = {
        "pass_pres_participle": "медиопассивное",
        "passive_perfect_participle": "совершенное",
    }[key]
    return participle_line(label, chosen, feminine, neuter)


def build_block(lemma: str, data: dict, base_forms: list[str], modal: bool) -> tuple[str, list[str]]:
    warnings: list[str] = []
    past = base_forms[0] if len(base_forms) >= 3 else ""
    future = strip_tha(base_forms[2]) if len(base_forms) >= 3 else ""
    present = six_forms(
        data.get("present") or {},
        choose_voice(lemma, data.get("present") or {}),
        forced=lemma,
    )
    imperfect = six_forms(
        data.get("paratatikos") or {},
        choose_voice(lemma, data.get("paratatikos") or {}),
        past=True,
    )
    aorist_voice = choose_voice(lemma, data.get("aorist") or {})
    aorist = six_forms(data.get("aorist") or {}, aorist_voice, forced=past)
    future_voice = choose_voice(lemma, data.get("conjunctive") or {})
    future_simple = with_tha(
        six_forms(data.get("conjunctive") or {}, future_voice, forced=future)
    )
    future_cont = with_tha(present)
    stem = nonfinite(data, lemma, future)
    has_simple = filled(aorist) or filled(future_simple)
    has_cont = filled(present) or filled(imperfect) or filled(future_cont)
    has_perfect = bool(stem)

    sections: list[tuple[str, list[tuple[str, list[str]]]]] = []
    present_aspects = []
    if has_simple and filled(present):
        present_aspects.append(("разовое", present))
    if has_cont and filled(present):
        present_aspects.append(("длительное", present))
    if has_perfect:
        present_aspects.append(("завершённое", perfect_rows(["έχω", "έχουμε", "έχεις", "έχετε", "έχει", "έχουν"], stem, modal)))
    if present_aspects:
        sections.append(("настоящее", present_aspects))

    past_aspects = []
    if filled(aorist):
        past_aspects.append(("разовое", aorist))
    if filled(imperfect):
        past_aspects.append(("длительное", imperfect))
    if has_perfect:
        past_aspects.append(("завершённое", perfect_rows(["είχα", "είχαμε", "είχες", "είχατε", "είχε", "είχαν"], stem, modal)))
    if past_aspects:
        sections.append(("прошедшее", past_aspects))

    future_aspects = []
    if filled(future_simple):
        future_aspects.append(("разовое", future_simple))
    if filled(future_cont):
        future_aspects.append(("длительное", future_cont))
    if has_perfect:
        future_aspects.append(
            ("завершённое", perfect_rows(["θα έχω", "θα έχουμε", "θα έχεις", "θα έχετε", "θα έχει", "θα έχουν"], stem, modal))
        )
    if future_aspects:
        sections.append(("будущее", future_aspects))

    if not sections:
        return "", ["пустая парадигма"]

    lines = ["# Спряжение", ""]
    for tense, aspects in sections:
        lines.append(f"## {tense}")
        for aspect, forms in aspects:
            lines.append(f"### {aspect}")
            lines.extend(rows(forms))
            lines.append("")
    text = "\n".join(lines).rstrip()

    simple_imp = imperative_pair(data.get("conjunctive") or {}, future_voice)
    cont_imp = imperative_pair(data.get("present") or {}, choose_voice(lemma, data.get("present") or {}))
    if simple_imp and cont_imp and simple_imp == cont_imp:
        cont_imp = None
    imp_lines = []
    if simple_imp or cont_imp:
        imp_lines.append("# Повелительное")
        if simple_imp and cont_imp:
            imp_lines.append("## разовое")
            imp_lines.append(f"{simple_imp[0] or '—'} | {simple_imp[1] or '—'}")
            imp_lines.append("")
            imp_lines.append("## длительное")
            imp_lines.append(f"{cont_imp[0] or '—'} | {cont_imp[1] or '—'}")
        else:
            pair = simple_imp or cont_imp
            imp_lines.append(f"{pair[0] or '—'} | {pair[1] or '—'}")

    part_lines = []
    active = as_list((data.get("act_pres_participle")))
    active_form = pick_form(active)
    if active_form:
        part_lines.append(f"активное: {active_form}")
    for key in ("pass_pres_participle", "passive_perfect_participle"):
        line = gendered(data, key)
        if line:
            part_lines.append(line)
    if part_lines:
        part_lines.insert(0, "# Причастие")

    chunks = [text]
    if imp_lines:
        chunks.append("\n".join(imp_lines))
    if part_lines:
        chunks.append("\n".join(part_lines))
    return "\n\n".join(chunks).rstrip() + "\n", warnings


def insert_block(text: str, block: str) -> str:
    match = re.search(r"^#\s*Контекст\s*$", text, re.M)
    piece = "\n" + block.rstrip() + "\n\n"
    if match:
        head = text[: match.start()].rstrip() + "\n"
        return head + piece + text[match.start() :]
    return text.rstrip() + "\n" + piece


def strip_generated(text: str) -> str:
    match = re.search(r"^#\s*Спряжение\s*$", text, re.M)
    if not match:
        return text
    rest = text[match.start() :]
    context = re.search(r"^#\s*Контекст\s*$", rest, re.M)
    head = text[: match.start()].rstrip() + "\n"
    if context:
        return head + "\n" + rest[context.start() :]
    return head


PERSON_GLOSS = (
    ("они", 5),
    ("она", 4),
    ("оно", 4),
    ("он", 4),
    ("вы", 3),
    ("мы", 1),
    ("ты", 2),
    ("я", 0),
)


def person_index(gloss: str) -> int | None:
    gloss = gloss.strip().lower()
    for prefix, index in PERSON_GLOSS:
        if gloss.startswith(prefix):
            return index
    return None


def forms_section(text: str) -> str:
    match = re.search(r"^#\s*Формы\s*$", text, re.M)
    if not match:
        return ""
    rest = text[match.end() :]
    nxt = re.search(r"^#\s+", rest, re.M)
    return rest[: nxt.start()] if nxt else rest


def form_groups(text: str) -> list[list[tuple[str, str]]]:
    groups: list[list[tuple[str, str]]] = []
    current: list[tuple[str, str]] = []
    for line in forms_section(text).splitlines():
        if not line.strip():
            if current:
                groups.append(current)
                current = []
            continue
        if " - " not in line:
            continue
        greek, gloss = line.split(" - ", 1)
        current.append((greek.strip(), gloss.strip()))
    if current:
        groups.append(current)
    return groups


def paradigm_from_group(pairs: list[tuple[str, str]]) -> list[str] | None:
    cells = [""] * 6
    for greek, gloss in pairs:
        index = person_index(gloss)
        if index is None or cells[index]:
            continue
        cells[index] = greek
    if all(cells):
        return cells
    return None


def left_cell(block: str, tense: str, aspect: str) -> str:
    match = re.search(
        rf"^## {tense}\n(?:.*\n)*?^### {aspect}\n([^|\n]+)",
        block,
        re.M,
    )
    return match.group(1).strip() if match else ""


def set_aspect_rows(block: str, tense: str, aspect: str, forms: list[str]) -> str:
    pattern = re.compile(
        rf"(^## {re.escape(tense)}\n(?:.*\n)*?^### {re.escape(aspect)}\n)(.*\n.*\n.*\n)",
        re.M,
    )
    replacement = "\n".join(rows(forms)) + "\n"
    updated, count = pattern.subn(lambda match: match.group(1) + replacement, block, count=1)
    return updated if count else block


def replace_perfect_stem(block: str, stem: str) -> str:
    if not stem:
        return block

    def repl(line: str) -> str:
        if not re.search(r"(έχ|είχ)", line):
            return line
        return re.sub(
            r"(?:^|(?<= ))(έχω|έχουμε|έχεις|έχετε|έχει|έχουν|είχα|είχαμε|είχες|είχατε|είχε|είχαν) (?=\S*[Α-ωά-ώ])\S+",
            lambda match: f"{match.group(1)} {stem}",
            line,
        )

    return "\n".join(repl(line) for line in block.splitlines())


def card_imperatives(text: str) -> tuple[list[str], list[str]]:
    singular: list[str] = []
    plural: list[str] = []
    for greek, gloss in [pair for group in form_groups(text) for pair in group]:
        if "повелит" not in gloss:
            continue
        if "мн." in gloss and greek not in plural:
            plural.append(greek)
        elif "ед." in gloss and greek not in singular:
            singular.append(greek)
    return singular, plural


def imperative_cells(block: str) -> tuple[str, str, str | None]:
    index = block.find("# Повелительное")
    if index < 0:
        return "", "", None
    tail = block[index:]
    headed = re.search(r"^## разовое\n([^|\n]+)\|([^\n]+)", tail, re.M)
    if headed:
        return headed.group(1).strip(), headed.group(2).strip(), "разовое"
    sole = re.search(r"^# Повелительное\n([^|\n]+)\|([^\n]+)", tail, re.M)
    if sole:
        return sole.group(1).strip(), sole.group(2).strip(), None
    return "", "", None


def set_imperative_line(block: str, aspect: str | None, singular: str, plural: str) -> str:
    marker = "# Повелительное"
    index = block.find(marker)
    if index < 0:
        return block
    line = f"{singular or '—'} | {plural or '—'}"
    head, tail = block[:index], block[index:]
    if aspect and re.search(rf"^## {aspect}\n.+$", tail, re.M):
        tail = re.sub(
            rf"(^## {aspect}\n).+$",
            lambda match: match.group(1) + line,
            tail,
            count=1,
            flags=re.M,
        )
    elif re.search(r"^# Повелительное\n[^#\n].+$", tail, re.M):
        tail = re.sub(
            r"(^# Повелительное\n).+$",
            lambda match: match.group(1) + line,
            tail,
            count=1,
            flags=re.M,
        )
    return head + tail


def overlay_card(block: str, source: str, lemma: str, base_forms: list[str]) -> str:
    past = base_forms[0] if len(base_forms) >= 3 else ""
    future = strip_tha(base_forms[2]) if len(base_forms) >= 3 else ""
    generated_past = strip_tha(left_cell(block, "прошедшее", "разовое"))
    generated_imperfect = strip_tha(left_cell(block, "прошедшее", "длительное"))
    generated_future = strip_tha(left_cell(block, "будущее", "разовое"))

    for group in form_groups(source):
        cells = paradigm_from_group(group)
        if not cells:
            continue
        head = strip_tha(cells[0])
        plain = [strip_tha(cell) for cell in cells]
        if past and accent_key(head) == accent_key(past):
            card_is_imperfect = (
                accent_key(head) == accent_key(generated_imperfect)
                and accent_key(head) != accent_key(generated_past)
            )
            if card_is_imperfect:
                block = set_aspect_rows(block, "прошедшее", "длительное", plain)
            else:
                block = set_aspect_rows(block, "прошедшее", "разовое", plain)
        elif accent_key(head) == accent_key(lemma):
            block = set_aspect_rows(block, "настоящее", "разовое", plain)
            block = set_aspect_rows(block, "настоящее", "длительное", plain)
            block = set_aspect_rows(block, "будущее", "длительное", with_tha(plain))
        elif future and accent_key(head) == accent_key(future):
            card_is_continuous = (
                accent_key(head) == accent_key(lemma)
                and accent_key(head) != accent_key(generated_future)
            )
            if not card_is_continuous:
                block = set_aspect_rows(block, "будущее", "разовое", with_tha(plain))
                block = replace_perfect_stem(block, plain[4])

    singular, plural = card_imperatives(source)
    if singular:
        current_sg, current_pl, aspect = imperative_cells(block)
        new_sg = current_sg if current_sg in singular else singular[0]
        new_pl = current_pl if plural and current_pl in plural else (plural[0] if plural else current_pl)
        if new_sg != current_sg or new_pl != current_pl:
            block = set_imperative_line(block, aspect, new_sg, new_pl)
    return block


def fix_ftaiw(block: str) -> str:
    return (
        block.replace("εφτάψ", "φταίξ")
        .replace("έφταψ", "έφταιξ")
        .replace("φτάψ", "φταίξ")
        .replace("εφταψ", "φταιξ")
        .replace("φταψ", "φταιξ")
    )


def fix_pwlo(block: str) -> str:
    for old, new in (
        ("πωλήσαμε", "πουλήσαμε"),
        ("πωλήσατε", "πουλήσατε"),
        ("πωλήσουμε", "πουλήσουμε"),
        ("πωλήσετε", "πουλήσετε"),
        ("πωλήσουν", "πουλήσουν"),
        ("πωλήσεις", "πουλήσεις"),
        ("πωλήσει", "πουλήσει"),
        ("πωλήστε", "πουλήστε"),
        ("πώλησαν", "πούλησαν"),
        ("πώλησες", "πούλησες"),
        ("πώλησε", "πούλησε"),
        ("πώλησα", "πούλησα"),
        ("πωλήσω", "πουλήσω"),
    ):
        block = block.replace(old, new)
    return block


def fix_pinw(block: str) -> str:
    mapping = {
        "θα πιώ": "θα πιω",
        "θα πιείς": "θα πιεις",
        "θα πιεί": "θα πιει",
        "θα πιούν": "θα πιουν",
    }

    def repl(match: re.Match[str]) -> str:
        return mapping[match.group(0)]

    return re.sub(r"θα πιώ|θα πιείς|θα πιούν|θα πιεί(?!τε)", repl, block)


def fix_koroidevo(block: str) -> str:
    return block.replace("κοροΐδεψ", "κορόιδεψ").replace("κοροΐδευ", "κορόιδευ")


LEMMA_FIXES = {
    "φταίω": fix_ftaiw,
    "πωλώ": fix_pwlo,
    "πίνω": fix_pinw,
    "κοροϊδεύω": fix_koroidevo,
}

KERANO = """# Спряжение

## настоящее
### разовое
κεράνω | κερνάμε
κερνάς | κερνάτε
κερνάει | κερνάνε

### длительное
κεράνω | κερνάμε
κερνάς | κερνάτε
κερνάει | κερνάνε

### завершённое
έχω κεράσει | έχουμε κεράσει
έχεις κεράσει | έχετε κεράσει
έχει κεράσει | έχουν κεράσει

## прошедшее
### разовое
κέρασα | κεράσαμε
κέρασες | κεράσατε
κέρασε | κέρασαν

### длительное
κερνούσα | κερνούσαμε
κερνούσες | κερνούσατε
κερνούσε | κερνούσαν

### завершённое
είχα κεράσει | είχαμε κεράσει
είχες κεράσει | είχατε κεράσει
είχε κεράσει | είχαν κεράσει

## будущее
### разовое
θα κεράσω | θα κεράσουμε
θα κεράσεις | θα κεράσετε
θα κεράσει | θα κεράσουν

### длительное
θα κεράνω | θα κερνάμε
θα κερνάς | θα κερνάτε
θα κερνάει | θα κερνάνε

### завершённое
θα έχω κεράσει | θα έχουμε κεράσει
θα έχεις κεράσει | θα έχετε κεράσει
θα έχει κεράσει | θα έχουν κεράσει

# Повелительное
## разовое
κέρασε | κεράστε

## длительное
κέρνα | κερνάτε

# Причастие
активное: κερνώντας
"""


def aspect_cell(block: str, tense: str, aspect: str) -> str:
    first = strip_tha(left_cell(block, tense, aspect))
    if first and first != "—":
        return first
    match = re.search(
        rf"^## {tense}\n(?:.*\n)*?^### {aspect}\n(?:.*\n){{2}}([^|\n]+)",
        block,
        re.M,
    )
    return strip_tha(match.group(1).strip()) if match else first


def main() -> int:
    written = 0
    skipped = 0
    failed: list[str] = []
    mismatched: list[str] = []

    for path in sorted(VERBS.glob("*.md")):
        if path.name == "readme.md":
            continue
        original = path.read_text(encoding="utf-8")
        lemma, base_forms = parse_base(original)
        if lemma in {"γίνομαι", "αισθάνομαι", "φυσάει"}:
            skipped += 1
            continue
        original = strip_generated(original)
        if not GREEK.fullmatch(lemma or ""):
            failed.append(f"{path.name}: лемма не одно слово ({lemma or '—'})")
            continue
        if lemma == "κεράνω":
            block = KERANO
        else:
            try:
                verb = Verb(lemma)
                data = verb.all()
                modal = bool(verb.basic_forms.get("modal"))
            except Exception as error:  # library rejects unknown or non-lemmas
                failed.append(f"{path.name}: {lemma}: {type(error).__name__}")
                continue
            block, warnings = build_block(lemma, data, base_forms, modal)
            if not block:
                failed.append(f"{path.name}: {lemma}: {', '.join(warnings) or 'пусто'}")
                continue
            block = overlay_card(block, original, lemma, base_forms)
            fix = LEMMA_FIXES.get(lemma)
            if fix:
                block = fix(block)
            if lemma == "πάω" and "πηγαίνοντας" not in block:
                if "# Причастие" in block:
                    block = block.replace("# Причастие\n", "# Причастие\nактивное: πηγαίνοντας\n", 1)
                else:
                    block = block.rstrip() + "\n\n# Причастие\nактивное: πηγαίνοντας\n"
        if len(base_forms) >= 3:
            past = base_forms[0]
            future = strip_tha(base_forms[2])
            notes = []
            got_past = aspect_cell(block, "прошедшее", "разовое")
            got_future = aspect_cell(block, "будущее", "разовое")
            if past and got_past and past != got_past:
                notes.append(f"прош. {past} ≠ {got_past}")
            if future and got_future and future != got_future:
                notes.append(f"буд. {future} ≠ {got_future}")
            if notes:
                mismatched.append(f"{lemma}: " + "; ".join(notes))
        path.write_text(insert_block(original, block), encoding="utf-8")
        written += 1

    print(f"записано {written}, уже было {skipped}, пропущено {len(failed)}")
    for line in failed:
        print("пропуск:", line)
    if mismatched:
        print(f"расхождение с «Базой»: {len(mismatched)}")
        for line in mismatched:
            print(" ", line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
