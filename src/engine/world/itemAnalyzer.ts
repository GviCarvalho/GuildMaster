import { EPS, mixTotal, type Mix } from '../dna';
import type { ItemId } from '../types';

const TAG_THRESHOLD = 0.05;

function relevantEntries(mix: Mix): [string, number][] {
  return Object.entries(mix).filter(([, v]) => v > EPS);
}

export function normalizeMix(mix: Mix): Mix {
  const filtered: Mix = {};
  for (const [k, v] of relevantEntries(mix)) {
    filtered[k] = v;
  }

  const total = mixTotal(filtered);
  if (total <= EPS) return {};

  const normalized: Mix = {};
  for (const [k, v] of Object.entries(filtered)) {
    normalized[k] = v / total;
  }
  return normalized;
}

export function mixSignature(mix: Mix): string {
  const normalized = normalizeMix(mix);
  const parts = Object.entries(normalized)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${(Math.round(v * 1000) / 1000).toFixed(3)}`);
  return parts.length ? parts.join('|') : 'empty';
}

function hasRelevant(mix: Mix, predicate: (entry: [string, number]) => boolean): boolean {
  return relevantEntries(mix).some(predicate);
}

function proportion(mix: Mix, keys: string[]): number {
  const normalized = normalizeMix(mix);
  return keys.reduce((acc, key) => acc + (normalized[key] ?? 0), 0);
}

function collectPrefixProportion(mix: Mix, prefix: string): number {
  const normalized = normalizeMix(mix);
  return Object.entries(normalized)
    .filter(([k]) => k.startsWith(prefix))
    .reduce((acc, [, v]) => acc + v, 0);
}

export function analyzeMix(mix: Mix): {
  tags: string[];
  traits: Record<string, number>;
  canonicalName: string;
  displayName: string;
  signature: string;
} {
  const normalized = normalizeMix(mix);
  const tags: string[] = [];

  const ore = hasRelevant(normalized, ([k, v]) => k.startsWith('ORE_') && v > TAG_THRESHOLD);
  const metal = hasRelevant(normalized, ([k, v]) => ['FE', 'CU', 'SN', 'AU'].includes(k) && v > TAG_THRESHOLD);
  const wood = hasRelevant(normalized, ([k, v]) => ['FIBER', 'RESIN'].includes(k) && v > TAG_THRESHOLD);
  const stone = hasRelevant(normalized, ([k, v]) => ['SILICA', 'MINERAL_DUST'].includes(k) && v > TAG_THRESHOLD);
  const food = hasRelevant(normalized, ([k, v]) => ['GLU', 'FRUCT', 'UMAMI', 'FAT', 'PROTEIN'].includes(k) && v > TAG_THRESHOLD);
  const drink = hasRelevant(normalized, ([k, v]) => k === 'H2O' && v > TAG_THRESHOLD);
  const fuel = hasRelevant(normalized, ([k, v]) => ['CARBON', 'COAL', 'ORE_COAL'].includes(k) && v > TAG_THRESHOLD);
  const toxic = hasRelevant(normalized, ([k, v]) => k.startsWith('TOX_') && v > TAG_THRESHOLD);
  const medicine = hasRelevant(normalized, ([k, v]) => k.startsWith('ANT_') && v > TAG_THRESHOLD);

  if (ore) tags.push('ore');
  if (metal) tags.push('metal');
  if (wood) tags.push('wood');
  if (stone) tags.push('stone');
  if (food) tags.push('food');
  if (drink) tags.push('drink');
  if (fuel) tags.push('fuel');
  if (toxic) tags.push('toxic');
  if (medicine) tags.push('medicine');
  if (food || wood || medicine) tags.push('organic');
  if (ore || stone || metal) tags.push('inorganic');

  const hydration = proportion(normalized, ['H2O']);
  const calories = proportion(normalized, ['GLU', 'FRUCT', 'FAT', 'PROTEIN']);
  const bitterness = proportion(normalized, ['AMARGO']);
  const umami = proportion(normalized, ['UMAMI']);
  const toxicity = collectPrefixProportion(normalized, 'TOX_');
  const mineralness = proportion(normalized, ['SILICA', 'MINERAL_DUST', 'SALT', 'SLAG']);
  const metalness = proportion(normalized, [
    'FE',
    'CU',
    'SN',
    'AU',
    'ORE_FE',
    'ORE_CU',
    'ORE_SN',
    'ORE_AU',
    'ORE_COAL',
  ]);

  const traits = {
    hydration,
    calories,
    bitterness,
    umami,
    toxicity,
    mineralness,
    metalness,
  } satisfies Record<string, number>;

  const oreEntries = Object.entries(normalized).filter(([k]) => k.startsWith('ORE_'));
  const dominantOre = oreEntries.length
    ? oreEntries.reduce((best, current) => (current[1] > best[1] ? current : best))[0]
    : undefined;

  const oreNameMap: Record<string, string> = {
    ORE_FE: 'Minério de Ferro',
    ORE_CU: 'Minério de Cobre',
    ORE_SN: 'Minério de Estanho',
    ORE_AU: 'Minério de Ouro',
  };

  let canonicalName = 'Material';
  if (tags.includes('ore')) {
    canonicalName = dominantOre ? oreNameMap[dominantOre] ?? 'Minério' : 'Minério';
  } else if (tags.includes('wood')) {
    canonicalName = 'Madeira';
  } else if (tags.includes('stone')) {
    canonicalName = 'Pedra';
  } else if (tags.includes('drink')) {
    canonicalName = traits.hydration > 0.8 ? 'Água' : 'Bebida';
  } else if (tags.includes('food')) {
    canonicalName = 'Comida';
  } else if (tags.includes('fuel')) {
    canonicalName = 'Combustível';
  }

  const qualifiers: string[] = [];
  if (traits.toxicity > 0.25) qualifiers.push('contaminado');
  if (traits.mineralness > 0.35 && tags.includes('drink')) qualifiers.push('salobra');
  if (traits.mineralness > 0.35 && (tags.includes('ore') || tags.includes('metal'))) qualifiers.push('impuro');
  if (traits.calories > 0.45 && tags.includes('food')) qualifiers.push('nutritivo');

  const displayName = qualifiers.length ? `${canonicalName} (${qualifiers.join(', ')})` : canonicalName;

  return {
    tags,
    traits,
    canonicalName,
    displayName,
    signature: mixSignature(mix),
  };
}

export interface AnalyzableItem {
  id: ItemId | string;
  name: string;
  mix: Mix;
  tags?: string[];
  traits?: Record<string, number>;
  canonicalName?: string;
  displayName?: string;
  signature?: string;
}

export function applyAnalysisToItem<T extends AnalyzableItem>(item: T): T {
  const analysis = analyzeMix(item.mix);
  // TODO: In modular crafting, downstream systems can lean on tags/traits/signature to unlock recipes and learning.
  return {
    ...item,
    ...analysis,
    name: analysis.displayName,
  };
}
