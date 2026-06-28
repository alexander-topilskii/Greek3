#!/usr/bin/env node
/**
 * Rename verb MD files to `{ru} {greek_present}.md`
 * Run: node scripts/rename-verbs.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VERBS_DIR = path.join(__dirname, '../words/verbs');

function parseBaza(content) {
  const match = content.match(/^#\s*База\s*\r?\n(.+)$/m);
  if (!match) throw new Error('No # База section found');
  const line = match[1].trim();
  const colonIdx = line.indexOf(':');
  if (colonIdx === -1) throw new Error(`Invalid База line: ${line}`);
  const translation = line.slice(0, colonIdx).trim();
  const formsPart = line.slice(colonIdx + 1).trim();
  const forms = formsPart.split(/\s*-\s*/).map((f) => f.trim());
  if (forms.length < 2) throw new Error(`Expected 3 forms, got: ${formsPart}`);
  return { translation, present: forms[1] };
}

function primaryTranslation(translation) {
  return translation.split('/')[0].trim();
}

function newFilename(translation, present) {
  return `${primaryTranslation(translation)} ${present}.md`;
}

const files = fs
  .readdirSync(VERBS_DIR)
  .filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md');

const renames = [];

for (const oldName of files) {
  const oldPath = path.join(VERBS_DIR, oldName);
  const content = fs.readFileSync(oldPath, 'utf-8');
  const { translation, present } = parseBaza(content);
  const newName = newFilename(translation, present);

  if (oldName === newName) {
    console.log(`SKIP (already named): ${oldName}`);
    continue;
  }

  renames.push({ oldName, newName, translation, present });
}

const newNames = renames.map((r) => r.newName);
const dupes = newNames.filter((n, i) => newNames.indexOf(n) !== i);
if (dupes.length) {
  console.error('Duplicate target filenames:', [...new Set(dupes)]);
  process.exit(1);
}

for (const { oldName, newName } of renames) {
  const oldPath = path.join(VERBS_DIR, oldName);
  const newPath = path.join(VERBS_DIR, newName);
  if (fs.existsSync(newPath)) {
    console.error(`Target already exists: ${newName}`);
    process.exit(1);
  }
  fs.renameSync(oldPath, newPath);
  console.log(`${oldName} → ${newName}`);
}

console.log(`\nRenamed ${renames.length} files`);
