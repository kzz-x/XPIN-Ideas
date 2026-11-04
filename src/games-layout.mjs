/** Pure physical layout helpers for L3 (chapter 2) and L5 (chapter 4).
 * Canonical cardIds[k] -> slotIds[k] is the semantic answer. These functions
 * only move those identities between columns; never grade by visual index.
 */
const U32_MAX = 0xffffffff;
const ACTIVE_CHAPTERS = new Set([2, 4]);

export function isRoundSeed(value) {
  return Number.isInteger(value) && value > 0 && value <= U32_MAX;
}

/** Pure migration/validation. Zero is the explicit "not yet generated" sentinel.
 * Calling restore during progress display or drag sync never draws randomness.
 */
export function restoreLayoutSeeds(value) {
  return Array.from({length: 5}, (_, chapter) =>
    ACTIVE_CHAPTERS.has(chapter) && Array.isArray(value) && isRoundSeed(value[chapter])
      ? value[chapter] : 0);
}

/** Call only at explicit round creation/restart, never during restore or drag. */
export function newRoundSeed(prior = 0) {
  const previous = isRoundSeed(prior) ? prior : 0;
  let next;
  try {
    if (typeof globalThis.crypto?.getRandomValues === 'function') {
      next = globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    }
  } catch { /* A normal non-security game seed also has the fallback below. */ }
  if (!isRoundSeed(next)) next = Math.floor(Math.random() * 0x100000000) >>> 0;
  // Also covers zero, repeated entropy, and uint32 wrap at the maximum prior.
  if (!isRoundSeed(next) || next === previous) next = previous === U32_MAX ? 1 : previous + 1;
  return next;
}

function permutations(values) {
  if (values.length === 0) return [[]];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, other) => other !== index)).map(rest => [value, ...rest]));
}
const ALL = permutations([0, 1, 2, 3]); // Exactly 4! canonical index permutations.
const isIdentity = order => order.every((value, index) => value === index);
const CARD_CHOICES = ALL.filter(order => !isIdentity(order));

function mix32(value) {
  let x = value >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}
function validIds(ids, label) {
  if (!Array.isArray(ids) || ids.length !== 4 || new Set(ids).size !== 4 ||
      ids.some(id => typeof id !== 'string' || id.length === 0)) {
    throw new TypeError(label + ' must contain exactly four distinct semantic ID strings');
  }
}

/** Stable, non-identity cards and slots, with no initially correct column.
 * IDs may be different vocabularies (HTML -> interactive) or the same (film -> film).
 * Both inputs retain their canonical semantic order and are never mutated.
 */
export function orders(seed, cardIds, slotIds) {
  if (!isRoundSeed(seed)) throw new RangeError('A round seed must be a nonzero uint32');
  validIds(cardIds, 'cardIds'); validIds(slotIds, 'slotIds');
  const cardIndices = CARD_CHOICES[mix32(seed) % CARD_CHOICES.length];
  const slotChoices = ALL.filter(order => !isIdentity(order) &&
    order.every((semanticIndex, column) => semanticIndex !== cardIndices[column]));
  const slotIndices = slotChoices[mix32(seed ^ 0xa511e9b3) % slotChoices.length];
  return Object.freeze({seed,
    cards: Object.freeze(cardIndices.map(index => cardIds[index])),
    slots: Object.freeze(slotIndices.map(index => slotIds[index]))});
}
