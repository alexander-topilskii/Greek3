import fs from 'fs';
import path from 'path';

const WORDS_DIR = 'words';
const PHRASES_DIR = path.join(WORDS_DIR, 'phrases');

function walkMd(dir, skipPhrases = false) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (skipPhrases && entry.name === 'phrases') continue;
      files.push(...walkMd(full, skipPhrases));
    } else if (entry.name.endsWith('.md') && entry.name !== 'readme.md') {
      files.push(full);
    }
  }
  return files;
}

function normalizeGreek(s) {
  return s
    .replace(/[.,;:!?«»""''()[\]{}]/g, '')
    .replace(/^[Ττ]ον\s+/i, '')
    .replace(/^[Ττ]ην?\s+/i, '')
    .replace(/^[Ττ]ο\s+/i, '')
    .replace(/^[Ηη]\s+/i, '')
    .replace(/^[Οο]\s+/i, '')
    .toLowerCase()
    .normalize('NFC');
}

function extractBaseGreek(content) {
  const m = content.match(/^#\s*База\s*\n(.+)$/m);
  if (!m) return '';
  const line = m[1].trim();
  const colon = line.indexOf(':');
  return colon >= 0 ? line.slice(colon + 1).trim() : line;
}

function extractForms(content) {
  const idx = content.indexOf('# Формы');
  if (idx < 0) return [];
  const rest = content.slice(idx);
  const end = rest.search(/\n#\s+\S/);
  const block = end >= 0 ? rest.slice(0, end) : rest;
  return block
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const dash = l.indexOf(' - ');
      return dash >= 0 ? l.slice(0, dash).trim() : l;
    });
}

function tokenizeGreek(text) {
  return text
    .split(/\s+/)
    .map((w) => w.replace(/^[.,;:!?«»""''()[\]{}]+|[.,;:!?«»""''()[\]{}]+$/g, ''))
    .filter(Boolean);
}

const dictFiles = walkMd(WORDS_DIR, true);
const dictText = dictFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const dictNorm = new Set();
for (const file of dictFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const base = extractBaseGreek(content);
  for (const part of base.split(/\s*-\s*/)) {
    for (const w of tokenizeGreek(part)) dictNorm.add(normalizeGreek(w));
  }
  for (const form of extractForms(content)) {
    for (const w of tokenizeGreek(form)) dictNorm.add(normalizeGreek(w));
  }
  // raw greek in file
  const greekMatches = content.match(/[\u0370-\u03FF\u1F00-\u1FFF]+/g) || [];
  for (const w of greekMatches) dictNorm.add(normalizeGreek(w));
}

const phraseFiles = fs.readdirSync(PHRASES_DIR).filter((f) => f.endsWith('.md') && f !== 'readme.md');

for (const file of phraseFiles.sort()) {
  const content = fs.readFileSync(path.join(PHRASES_DIR, file), 'utf8');
  const greek = extractBaseGreek(content);
  const tokens = tokenizeGreek(greek);
  const forms = extractForms(content);
  const hasWordBreakdown = forms.some((f) => {
    const t = tokenizeGreek(f);
    return t.length === 1 && normalizeGreek(t[0]).length > 0;
  });
  const missing = tokens.filter((t) => !dictNorm.has(normalizeGreek(t)));
  console.log(`\n${file}`);
  console.log(`  Greek: ${greek}`);
  console.log(`  Word breakdown in forms: ${hasWordBreakdown ? 'yes' : 'NO'}`);
  if (missing.length) console.log(`  Missing from dict: ${missing.join(', ')}`);
}
