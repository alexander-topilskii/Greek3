#!/usr/bin/env python3
"""
Greek3 Book Checker & Extractor for EPUB adaptation.
Validates Greek text against the project dictionary and extracts EPUB chapters.
"""

import os
import re
import sys
import json
import zipfile
import unicodedata
from html.parser import HTMLParser
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WORDS_DIR = BASE_DIR / "words"
DIST_CATALOG = BASE_DIR / "dist" / "catalog.json"
EPUB_PATH = BASE_DIR / "books" / "robert_hajnlajn-dver_v_leto.epub"

# Common Greek functional particles, articles, pronouns that may not have standalone word cards
CORE_GRAMMAR_WORDS = {
    # Articles
    "ο", "η", "το", "οι", "τα",
    "του", "της", "τον", "την",
    "των", "τους", "τις",
    "στο", "στη", "στην", "στον", "στα", "στους", "στις", "στων",
    "ένας", "ένα", "μια", "μιας", "ενός",
    # Prepositions & Conjunctions
    "σε", "με", "για", "από", "ως", "προς", "χωρίς", "μέχρι", "κατά",
    "και", "κι", "αλλά", "όμως", "αν", "να", "θα", "όταν", "γιατί", "πως", "ότι", "ώστε",
    "ούτε", "μήτε", "ή", "είτε", "σαν", "καθώς", "αφού", "πριν", "ενώ",
    # Particles & Adverbs
    "δεν", "δε", "μην", "μη", "ας", "ναι", "όχι", "πια", "μόνο", "μαζί",
    "πολύ", "λίγο", "τόσο", "πιο", "όλο", "ακόμα", "ακόμη", "ήδη", "πάλι", "ξανά",
    "εδώ", "εκεί", "τώρα", "τότε", "πάντα", "ποτέ", "παντού", "πουθενά",
    "μέσα", "έξω", "πάνω", "κάτω", "μπροστά", "πίσω", "κοντά", "μακριά",
    # Sounds & onomatopoeia
    "νιάου",
    # Pronouns
    "εγώ", "εσύ", "αυτός", "αυτή", "αυτό", "εμείς", "εσείς", "αυτοί", "αυτές", "αυτά",
    "μου", "σου", "του", "της", "μας", "σας", "τους",
    "με", "σε", "τον", "την", "το", "μας", "σας", "τους", "τις", "τα",
    "μου", "σου", "του", "της",
    "ποιος", "ποια", "ποιο", "ποιοι", "ποιες", "ποια", "τι", "ποιον", "ποιαν",
    "κάποιος", "κάποια", "κάποιο", "κάποιοι", "κάποιες", "κάποια",
    "κανείς", "καμία", "κανένα", "κανένας", "τίποτα", "τίποτε",
    "όλος", "όλη", "όλο", "όλοι", "όλες", "όλα", "όλους", "όλων",
    "άλλος", "άλλη", "άλλο", "άλλοι", "άλλες", "άλλα", "άλλους", "άλλων",
    "δικός", "δική", "δικό", "δικοί", "δικές", "δικά",
    "μου", "σου", "του",
    # Allowed proper names in book
    "πιτ", "πετρόνιος", "πετρονιος", "νταν", "ντάνιελ", "ντανιελ", "κονέκτικατ", "σαν", "σουσί",
    "λος", "άντζελες", "μάιλς", "μαιλς", "μπέλα", "μπελα", "σάλι", "σαλι", "τσάρλι", "τσαρλι",
    "ρίκι", "ρικι", "φρεντερίκα", "φρεντερικα", "τζον", "τζέικ", "τζεικ",
}

def strip_accents(text: str) -> str:
    """Removes Greek accent marks and converts to lowercase."""
    return "".join(
        c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn"
    ).lower()

def clean_token(token: str) -> str:
    """Strips punctuation from token ends."""
    return re.sub(r"^[^\w\s]+|[^\w\s]+$", "", token, flags=re.UNICODE)

def is_greek(token: str) -> bool:
    """Checks if token contains Greek letters."""
    return any("\u0370" <= c <= "\u03ff" or "\u1f00" <= c <= "\u1fff" for c in token)

class ProjectDictionary:
    def __init__(self):
        self.exact_map = {}   # greek_token_lower -> list of card info
        self.norm_map = {}    # stripped_accents -> list of card info
        self.cards = {}       # slug -> card summary
        self.load()

    def add_entry(self, greek_word: str, slug: str, translation: str, category: str):
        cleaned = clean_token(greek_word)
        if not cleaned or not is_greek(cleaned):
            return
        lower = cleaned.lower()
        norm = strip_accents(lower)

        card_info = {
            "slug": slug,
            "translation": translation,
            "category": category,
            "greek": cleaned
        }

        self.exact_map.setdefault(lower, []).append(card_info)
        self.norm_map.setdefault(norm, []).append(card_info)

        if category == "adjectives" and norm.endswith("ος"):
            stem = norm[:-2]
            for ending in ["η", "ο", "οι", "ες", "α", "ους"]:
                self.norm_map.setdefault(stem + ending, []).append(card_info)
        elif category == "nouns":
            if norm.endswith("ας") or norm.endswith("ης") or norm.endswith("ος"):
                stem = norm[:-2]
                for ending in ["α", "ο", "ες", "ους"]:
                    self.norm_map.setdefault(stem + ending, []).append(card_info)

    def load(self):
        # 1. Load from dist/catalog.json if available
        if DIST_CATALOG.exists():
            with open(DIST_CATALOG, encoding="utf-8") as f:
                catalog = json.load(f)
            for w in catalog.get("words", []):
                slug = w.get("slug", "")
                tr = w.get("translation", "")
                cat = w.get("category", "")
                self.cards[slug] = w

                for tok in w.get("primaryGreek", "").split():
                    self.add_entry(tok, slug, tr, cat)
                for bf in w.get("baseForms", []):
                    for tok in bf.split():
                        self.add_entry(tok, slug, tr, cat)
                for f_item in w.get("forms", []):
                    for tok in f_item.get("greek", "").split():
                        self.add_entry(tok, slug, tr, cat)
                for ex in w.get("examples", []):
                    for tok in ex.get("greek", "").split():
                        self.add_entry(tok, slug, tr, cat)

        # 2. Also scan all words/*.md files directly for any additional forms/examples
        if WORDS_DIR.exists():
            for md_file in WORDS_DIR.rglob("*.md"):
                if md_file.name.lower() == "readme.md":
                    continue
                rel_slug = str(md_file.relative_to(WORDS_DIR)).replace(".md", "")
                try:
                    content = md_file.read_text(encoding="utf-8", errors="ignore")
                    # Find Greek tokens
                    for tok in re.findall(r"[\u0370-\u03ff\u1f00-\u1fff]+", content):
                        self.add_entry(tok, rel_slug, "", md_file.parent.name)
                except Exception:
                    pass

    def lookup(self, token: str):
        """Looks up a Greek token. Returns (matched, card_matches, is_grammar)."""
        cleaned = clean_token(token)
        if not cleaned or not is_greek(cleaned):
            return True, [], True
        
        lower = cleaned.lower()
        norm = strip_accents(lower)

        if lower in CORE_GRAMMAR_WORDS or norm in CORE_GRAMMAR_WORDS:
            return True, self.exact_map.get(lower, self.norm_map.get(norm, [])), True

        if lower in self.exact_map:
            return True, self.exact_map[lower], False
        if norm in self.norm_map:
            return True, self.norm_map[norm], False

        return False, [], False

def check_text(text: str, dict_idx: ProjectDictionary):
    """Checks Greek text against the dictionary."""
    tokens = re.findall(r"[\w\u0370-\u03ff\u1f00-\u1fff]+", text)
    greek_tokens = [t for t in tokens if is_greek(t)]
    
    total = len(greek_tokens)
    known = 0
    unknown = []
    matches = {}

    for t in greek_tokens:
        found, cards, is_grammar = dict_idx.lookup(t)
        if found:
            known += 1
            if cards:
                matches[t.lower()] = cards[0]
        else:
            unknown.append(t)

    percent = (known / total * 100) if total > 0 else 100.0
    return {
        "total": total,
        "known": known,
        "percent": round(percent, 1),
        "unknown": sorted(set(unknown), key=lambda x: strip_accents(x)),
        "matches": matches
    }

class EPUBExtractor:
    def __init__(self, epub_path=EPUB_PATH):
        self.epub_path = epub_path

    class SimpleHTMLParser(HTMLParser):
        def __init__(self):
            super().__init__()
            self.paragraphs = []
            self.cur = []
            self.in_p = False

        def handle_starttag(self, tag, attrs):
            if tag in ["p", "div", "h1", "h2", "h3"]:
                self.in_p = True
                self.cur = []

        def handle_endtag(self, tag):
            if tag in ["p", "div", "h1", "h2", "h3"]:
                text = " ".join("".join(self.cur).split())
                if text:
                    self.paragraphs.append(text)
                self.cur = []
                self.in_p = False

        def handle_data(self, data):
            if self.in_p:
                self.cur.append(data)

    CHAPTER_FILE_MAP = {
        1: ['OPS/ch1-2.xhtml'],
        2: ['OPS/ch1-3.xhtml', 'OPS/ch1-4.xhtml'],
        3: ['OPS/ch1-5.xhtml'],
        4: ['OPS/ch1-6.xhtml'],
        5: ['OPS/ch1-7.xhtml'],
        6: ['OPS/ch1-8.xhtml'],
        7: ['OPS/ch1-9.xhtml'],
        8: ['OPS/ch1-10.xhtml'],
        9: ['OPS/ch1-11.xhtml'],
        10: ['OPS/ch1-12.xhtml'],
        11: ['OPS/ch1-13.xhtml'],
        12: ['OPS/ch1-14.xhtml'],
    }

    def get_chapter_paragraphs(self, chapter_num: int):
        with zipfile.ZipFile(self.epub_path, "r") as z:
            files = self.CHAPTER_FILE_MAP.get(chapter_num)
            if not files:
                name = f"OPS/ch1-{chapter_num + 1}.xhtml" if chapter_num > 0 else "OPS/ch1.xhtml"
                if name not in z.namelist():
                    name = f"OPS/ch{chapter_num}.xhtml"
                files = [name]
            paragraphs = []
            for f in files:
                if f not in z.namelist():
                    continue
                raw = z.read(f).decode("utf-8")
                parser = self.SimpleHTMLParser()
                parser.feed(raw)
                paragraphs.extend(parser.paragraphs)
            return paragraphs

def generate_vocab_markdown(text: str, dict_idx: ProjectDictionary) -> str:
    tokens = re.findall(r"[\w\u0370-\u03ff\u1f00-\u1fff]+", text)
    greek_tokens = [t for t in tokens if is_greek(t)]
    
    seen_slugs = set()
    cards_by_cat = {}
    
    for t in greek_tokens:
        found, cards, is_grammar = dict_idx.lookup(t)
        if cards:
            card = cards[0]
            slug = card.get("slug")
            if slug and slug not in seen_slugs:
                seen_slugs.add(slug)
                cat = card.get("category", "other")
                cards_by_cat.setdefault(cat, []).append(card)

    cat_titles = [
        ("verbs", "Глаголы (Ρήματα)"),
        ("nouns", "Существительные (Ουσιαστικά)"),
        ("adjectives", "Прилагательные (Επίθετα)"),
        ("adverbs", "Наречия (Επιρρήματα)"),
        ("pronouns", "Местоимения (Αντωνυμίες)"),
        ("particles", "Частицы и союзы (Μόρια & Σύνδεσμοι)"),
        ("numbers", "Числительные (Αριθμοί)"),
    ]

    lines = ["---", "### 📚 Словарь главы (ссылки на карточки проекта)", ""]
    for cat_key, cat_title in cat_titles:
        cat_cards = cards_by_cat.get(cat_key, [])
        if not cat_cards:
            continue
        lines.append(f"#### {cat_title}")
        # Sort cards by translation or greek
        sorted_cards = sorted(cat_cards, key=lambda c: c.get("translation", "") or c.get("slug", ""))
        for c in sorted_cards:
            slug = c.get("slug", "")
            base_name = slug.split("/")[-1]
            tr = c.get("translation", "")
            lines.append(f"- [{base_name}](../../words/{slug}.md) — {tr}")
        lines.append("")

    return "\n".join(lines)

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Greek3 Book Extractor & Vocabulary Checker")
    parser.add_argument("--chapter", type=int, help="Extract paragraphs from given chapter number")
    parser.add_argument("--check", type=str, help="Check text or file against project dictionary")
    parser.add_argument("--vocab", type=str, help="Generate vocabulary markdown for text file")
    args = parser.parse_args()

    extractor = EPUBExtractor()
    dict_idx = ProjectDictionary()

    if args.chapter:
        paras = extractor.get_chapter_paragraphs(args.chapter)
        print(f"Extracted {len(paras)} paragraphs from chapter {args.chapter}:")
        for i, p in enumerate(paras[:10]):
            print(f"[{i}] {p[:120]}...")

    if args.check:
        text = args.check
        if os.path.exists(text):
            raw = Path(text).read_text(encoding="utf-8")
            el_lines = re.findall(r"- \*\*EL:\*\*(.*)", raw)
            text = "\n".join(el_lines) if el_lines else raw
        res = check_text(text, dict_idx)
        print(f"Checked: {res['known']}/{res['total']} words ({res['percent']}%)")
        if res["unknown"]:
            print(f"Unknown words ({len(res['unknown'])}): {', '.join(res['unknown'])}")
        else:
            print("100% of words matched the project dictionary!")

    if args.vocab:
        text = Path(args.vocab).read_text(encoding="utf-8")
        print(generate_vocab_markdown(text, dict_idx))
