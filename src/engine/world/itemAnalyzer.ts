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
  const metal = hasRelevant(normalized, ([k, v]) => ['IRON', 'FE', 'CU', 'SN', 'AU'].includes(k) && v > TAG_THRESHOLD);
  const fiberShare = proportion(normalized, ['FIBER']);
  const resinShare = proportion(normalized, ['RESIN']);
  const wood = resinShare > 0.1 || (fiberShare > 0.25 && resinShare > 0.05);
  const fiber = fiberShare > TAG_THRESHOLD;
  const stone = !ore && hasRelevant(normalized, ([k, v]) => ['SILICA', 'MINERAL_DUST'].includes(k) && v > TAG_THRESHOLD);
  const hydration = proportion(normalized, ['H2O']);
  const food = hasRelevant(normalized, ([k, v]) => ['GLU', 'FRUCT', 'UMAMI', 'FAT', 'PROTEIN'].includes(k) && v > TAG_THRESHOLD);
  const drink = hydration > 0.2;
  const fuel = hasRelevant(normalized, ([k, v]) => ['CARBON', 'COAL', 'ORE_COAL'].includes(k) && v > TAG_THRESHOLD);
  const reactive = hasRelevant(normalized, ([k, v]) =>
    ['OXIDIZER', 'PH_ACID', 'PH_BASE', 'CHELATOR'].includes(k) && v > TAG_THRESHOLD,
  );
  const balancer = hasRelevant(normalized, ([k, v]) => k === 'PH_BUFFER' && v > TAG_THRESHOLD);
  const forgedMarker = normalized.FORGED ?? 0;
  const refinedMarker = normalized.REFINED ?? 0;

  if (ore) tags.push('ore');
  if (metal) tags.push('metal');
  if (wood) tags.push('wood');
  else if (fiber) tags.push('fiber');
  if (stone) tags.push('stone');
  if (food) tags.push('food');
  if (drink) tags.push('drink');
  if (fuel) tags.push('fuel');
  if (reactive) tags.push('reactive');
  if (balancer) tags.push('balancing');
  if (food || wood) tags.push('organic');
  if (ore || stone || metal) tags.push('inorganic');
  if (forgedMarker > TAG_THRESHOLD) {
    tags.push('forged');
    if (!tags.includes('tool')) tags.push('tool');
  }
  if (refinedMarker > TAG_THRESHOLD) {
    tags.push('refined');
    if (!tags.includes('material')) tags.push('material');
  }

  const calories = proportion(normalized, ['GLU', 'FRUCT', 'FAT', 'PROTEIN']);
  const bitterness = proportion(normalized, ['AMARGO']);
  const umami = proportion(normalized, ['UMAMI']);
  const mineralness = proportion(normalized, ['SILICA', 'MINERAL_DUST', 'SALT', 'SLAG']);
  const metalness = proportion(normalized, [
    'IRON',
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

  const oxidizingPower = proportion(normalized, ['OXIDIZER']);
  const acidityPotential = proportion(normalized, ['PH_ACID']);
  const basicityPotential = proportion(normalized, ['PH_BASE']);
  const chelatingPower = proportion(normalized, ['CHELATOR']);
  const bufferingPower = proportion(normalized, ['PH_BUFFER']);
  const osmoticLoad = proportion(normalized, ['SALT']);
  const reactivity = oxidizingPower + acidityPotential + basicityPotential + chelatingPower + osmoticLoad;

  const traits = {
    hydration,
    calories,
    bitterness,
    umami,
    mineralness,
    metalness,
    oxidizingPower,
    acidityPotential,
    basicityPotential,
    chelatingPower,
    bufferingPower,
    osmoticLoad,
    reactivity,
  } satisfies Record<string, number>;

  const oreEntries = Object.entries(normalized).filter(([k]) => k.startsWith('ORE_'));
  const dominantOre = oreEntries.length
    ? oreEntries.reduce((best, current) => (current[1] > best[1] ? current : best))[0]
    : undefined;
  const metalCandidates = ['FE', 'IRON', 'CU', 'SN', 'AU', 'ORE_FE', 'ORE_CU', 'ORE_SN', 'ORE_AU'];
  const dominantMetalEntry = Object.entries(normalized)
    .filter(([k]) => metalCandidates.includes(k))
    .reduce<[string, number] | null>((best, current) => {
      if (!best || current[1] > best[1]) return current;
      return best;
    }, null);
  const dominantMetal = dominantMetalEntry?.[0];

  const oreNameMap: Record<string, string> = {
    ORE_FE: 'Minério de Ferro',
    ORE_CU: 'Minério de Cobre',
    ORE_SN: 'Minério de Estanho',
    ORE_AU: 'Minério de Ouro',
  };

  const metalNameMap: Record<string, string> = {
    FE: 'Ferro',
    IRON: 'Ferro',
    CU: 'Cobre',
    SN: 'Estanho',
    AU: 'Ouro',
    ORE_FE: 'Ferro',
    ORE_CU: 'Cobre',
    ORE_SN: 'Estanho',
    ORE_AU: 'Ouro',
  };

  let canonicalName = 'Material';
  if (forgedMarker > TAG_THRESHOLD && (tags.includes('metal') || tags.includes('ore'))) {
    const metalName = dominantMetal ? metalNameMap[dominantMetal] ?? 'Metal' : 'Metal';
    canonicalName = `Ferramenta de ${metalName}`;
  } else if (refinedMarker > TAG_THRESHOLD && (tags.includes('ore') || tags.includes('metal'))) {
    const metalName = dominantMetal ? metalNameMap[dominantMetal] ?? 'Metal' : 'Metal';
    canonicalName = dominantMetal ? `Lingote de ${metalName}` : 'Metal Refinado';
  } else if (tags.includes('ore')) {
    canonicalName = dominantOre ? oreNameMap[dominantOre] ?? 'Minério' : 'Minério';
  } else if (tags.includes('wood')) {
    canonicalName = 'Madeira';
  } else if (tags.includes('stone')) {
    canonicalName = 'Pedra';
  } else if (tags.includes('drink')) {
    canonicalName = traits.hydration > 0.7 && (normalized.H2O ?? 0) > 0.7 ? 'Água' : 'Bebida';
  } else if (tags.includes('food')) {
    canonicalName = 'Comida';
  } else if (tags.includes('fuel')) {
    canonicalName = 'Combustível';
  }

  const qualifiers: string[] = [];
  if (traits.mineralness > 0.35 && tags.includes('drink')) qualifiers.push('salobra');
  if (traits.mineralness > 0.35 && (tags.includes('ore') || tags.includes('metal'))) qualifiers.push('impuro');
  if (traits.calories > 0.45 && tags.includes('food')) qualifiers.push('nutritivo');
  if (traits.reactivity > 0.35) qualifiers.push('reativo');

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
