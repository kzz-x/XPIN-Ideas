import {restoreLayoutSeeds, newRoundSeed} from './games-layout.mjs';

// Semantic identities retained from the supplied R03 r03 interaction package.
export const WORDS = ['主体', '构图', '色彩', '光影', '材质', '氛围'];
export const STEP_IDS = ['goal', 'reference', 'task', 'route', 'make', 'deliver'];
export const STEP_NAMES = ['明确目标', '寻找参考', '拆解任务', '选择路线', '制作验证', '整理交付'];
export const TOOL_IDS = ['html', 'blender', 'seedance', 'ae'];
export const TOOL_NAMES = ['HTML', 'Blender', 'Seedance', 'After Effects'];
export const USE_IDS = ['interactive', 'quality', 'generation', 'editable'];
export const USE_NAMES = ['亲手互动', '可控三维', '生成影片', '可编辑合成'];
export const TOOL_MATCH = Object.freeze({html: 'interactive', blender: 'quality', seedance: 'generation', ae: 'editable'});
export const PRODUCT_IDS = ['G1', 'SU7', 'VisionPro', 'Rubin'];
export const CARGO_IDS = ['film', 'island', 'project', 'stamp'];
export const CARGO_NAMES = ['影片卡', '互动场景', '工程盒', '发布印章'];
export const COUNTS = [6, 6, 4, 4, 4];
export const STORAGE_KEY = 'linggan-scroll-v3-director-v2-games-1';

export function restorePlay(value) {
  const done = COUNTS.map((n, i) => [...new Set((value?.done?.[i] || []).filter(x => Number.isInteger(x) && x >= 0 && x < n))]);
  // Never inherit the old island's stamp-first completion loophole.
  if (![0, 1, 2].every(k => done[4].includes(k))) done[4] = done[4].filter(k => k !== 3);
  return {
    version: 1,
    done,
    errors: COUNTS.map((_, i) => Math.max(0, Math.min(2, Math.floor(Number(value?.errors?.[i]) || 0)))),
    seen: COUNTS.map((_, i) => !!value?.seen?.[i]),
    layoutSeeds: restoreLayoutSeeds(value?.layoutSeeds),
    product: Math.max(0, Math.min(3, Math.floor(Number(value?.product) || 0)))
  };
}

export function ensureSeeds(state) {
  for (const i of [2, 4]) if (!state.layoutSeeds[i]) state.layoutSeeds[i] = newRoundSeed();
  return state;
}

export function stampUnlocked(state) { return [0, 1, 2].every(k => state.done[4].includes(k)); }
export function completed(state, chapter) { return state.done[chapter].length === COUNTS[chapter]; }
export function currentStep(state, chapter) { return Array.from({length: COUNTS[chapter]}, (_, i) => i).find(i => !state.done[chapter].includes(i)) ?? -1; }

export function validateDrop(chapter, id, slot, state) {
  if (slot == null || ![1, 2, 4].includes(chapter)) return 'cancel';
  const ids = chapter === 1 ? STEP_IDS : chapter === 2 ? TOOL_IDS : CARGO_IDS;
  const slots = chapter === 2 ? USE_IDS : ids;
  const k = ids.indexOf(id), j = slots.indexOf(slot);
  if (k < 0 || j < 0 || state.done[chapter].includes(k)) return 'cancel';
  if (chapter === 4 && id === 'stamp' && !stampUnlocked(state)) return 'locked';
  if (chapter === 2) return TOOL_MATCH[id] === slot ? 'correct' : 'wrong';
  return id === slot ? 'correct' : 'wrong';
}

export function markStep(state, chapter, index) {
  if (chapter < 0 || chapter > 4 || index < 0 || index >= COUNTS[chapter]) return false;
  if (chapter === 4 && index === 3 && !stampUnlocked(state)) return false;
  if (!state.done[chapter].includes(index)) state.done[chapter].push(index);
  state.errors[chapter] = 0;
  return true;
}

export function resetChapter(state, chapter) {
  state.done[chapter] = [];
  state.errors[chapter] = 0;
  state.seen[chapter] = false;
  if ([2, 4].includes(chapter)) state.layoutSeeds[chapter] = newRoundSeed(state.layoutSeeds[chapter]);
  if (chapter === 3) state.product = 0;
}

export function readProgress(storage = globalThis.localStorage) {
  try { return ensureSeeds(restorePlay(JSON.parse(storage.getItem(STORAGE_KEY) || 'null'))); }
  catch { return ensureSeeds(restorePlay()); }
}

export function saveProgress(state, storage = globalThis.localStorage) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(restorePlay(state))); return true; }
  catch { return false; }
}
