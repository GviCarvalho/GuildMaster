import { mixMerge, mixScale, runReactor, type Mix, type ReactionRule } from '../dna';
import type { CraftIntent, CraftProcess } from '../types';
import type { ItemDefinition, ItemRegistry } from '../world/items';

export function combineMixes(items: ItemDefinition[], weights?: number[]): Mix {
  if (items.length === 0) return {};
  const normalizedWeights = weights && weights.length === items.length
    ? weights
    : new Array(items.length).fill(1);
  const weightSum = normalizedWeights.reduce((acc, w) => acc + Math.max(w, 0), 0) || items.length;

  return items.reduce<Mix>((acc, item, idx) => {
    const weight = Math.max(normalizedWeights[idx] ?? 1, 0) / weightSum;
    const scaled = mixScale(item.mix, weight);
    return mixMerge(acc, scaled);
  }, {});
}

export function processOptions(process: CraftProcess): {
  temperature?: number;
  tags?: Record<string, number>;
  catalysts?: Mix;
  steps?: number;
  dt?: number;
} {
  switch (process) {
    case 'forge':
      return { temperature: 0.9, tags: { heat: 1 }, steps: 8, dt: 0.8 };
    case 'cook':
      return { temperature: 0.65, tags: { heat: 0.6, wet: 0.2 }, steps: 6, dt: 0.6 };
    case 'brew':
      return { temperature: 0.55, tags: { wet: 1 }, steps: 10, dt: 0.5 };
    case 'refine':
      return { temperature: 0.75, tags: { heat: 0.8, oxidize: 0.5 }, steps: 7, dt: 0.7 };
    default:
      return {};
  }
}

interface RandomLike {
  choice<T>(array: T[]): T;
  next?(): number;
}

export function craftOnce(
  random: RandomLike,
  itemRegistry: ItemRegistry,
  reactions: ReactionRule[],
  inputs: ItemDefinition[],
  process: CraftProcess,
  labelHint: string,
  weights?: number[],
): string {
  const combined = combineMixes(inputs, weights);
  const options = processOptions(process);
  const variation = typeof random?.choice === 'function' && 'next' in random ? random.next!() : Math.random();
  const reactedMix = runReactor(
    combined,
    { ...options, tags: { ...(options.tags ?? {}), variation } },
    reactions,
  );
  const label = labelHint || `${process} craft`;
  return itemRegistry.spawnFromMix(label, reactedMix);
}
