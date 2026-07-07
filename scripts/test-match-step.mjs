const pairs = [
  { greek: 'κοιμήθηκα', translation: 'я спал' },
  { greek: 'κοιμήθηκα', translation: 'я спала' },
  { greek: 'κοιμάμαι', translation: 'я сплю' },
  { greek: 'θα κοιμηθώ', translation: 'я буду спать' },
];

function findPairIndex(pairs, matchedPairIds, greekText, ruText) {
  return pairs.findIndex(
    (pair, index) =>
      !matchedPairIds.has(index) &&
      pair.greek === greekText &&
      pair.translation === ruText,
  );
}

const matched = new Set();
const greekText = 'κοιμήθηκα';
const ruText = 'я спал';
const index = findPairIndex(pairs, matched, greekText, ruText);

if (index !== 0) {
  throw new Error(`Expected pair index 0 for κοιμήθηκα ↔ я спал, got ${index}`);
}

matched.add(index);
const wrongIndex = findPairIndex(pairs, matched, greekText, 'я спала');
if (wrongIndex !== 1) {
  throw new Error(`Expected remaining κοιμήθηκα pair at index 1, got ${wrongIndex}`);
}

console.log('✓ match step duplicate greek pairing');
