function normalizeGreek(text) {
  return String(text ?? '').normalize('NFC');
}

function splitGreekLetters(text) {
  return [...normalizeGreek(text)];
}

function buildAssemblyText(bank, assembly) {
  const byId = new Map(bank.map((item) => [item.id, item.char]));
  return assembly.map((id) => byId.get(id) ?? '').join('');
}

const bank = [
  { id: 0, char: 'κ' },
  { id: 1, char: 'ο' },
  { id: 2, char: 'ι' },
  { id: 3, char: 'μ' },
  { id: 4, char: 'ά' },
  { id: 5, char: 'μ' },
  { id: 6, char: 'α' },
  { id: 7, char: 'ι' },
  { id: 8, char: 'β' },
  { id: 9, char: 'γ' },
];

const target = 'κοιμάμαι';
const assembly = [0, 1, 2, 3, 4, 5, 6, 7];
const built = normalizeGreek(buildAssemblyText(bank, assembly));

if (built !== normalizeGreek(target)) {
  throw new Error(`Expected assembled "${target}", got "${built}"`);
}

const wrongAssembly = [0, 1, 2, 3, 4, 5, 6, 8];
const wrongBuilt = normalizeGreek(buildAssemblyText(bank, wrongAssembly));
if (wrongBuilt === normalizeGreek(target)) {
  throw new Error('Wrong assembly should not match target');
}

console.log('✓ spell step assembly check');
