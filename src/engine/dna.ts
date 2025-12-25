/**
 * Lightweight chemistry/DNA sandbox inspired by the design discussion.
 *
 * Each item/NPC organ can be represented as a Mix (dictionary of substances -> quantity).
 * Reactions consume/produce substances over simulation ticks and can be gated by conditions
 * such as temperature, pH, catalysts/enzymes, or arbitrary world tags.
 */

export type Substance = string;
export type Mix = Record<Substance, number>;

const EPS = 1e-9;

export function mixGet(mix: Mix, key: Substance): number {
  return mix[key] ?? 0;
}

export function mixAdd(mix: Mix, key: Substance, value: number): void {
  if (Math.abs(value) < 1e-12) return;
  const next = (mix[key] ?? 0) + value;
  if (next <= EPS) {
    delete mix[key];
  } else {
    mix[key] = next;
  }
}

export function mixScale(mix: Mix, scale: number): Mix {
  const out: Mix = {};
  for (const [k, v] of Object.entries(mix)) {
    const next = v * scale;
    if (next > EPS) out[k] = next;
  }
  return out;
}

export function mixMerge(base: Mix, delta: Mix): Mix {
  const out: Mix = { ...base };
  for (const [k, v] of Object.entries(delta)) {
    mixAdd(out, k, v);
  }
  return out;
}

export function mixTotal(mix: Mix): number {
  return Object.values(mix).reduce((acc, v) => acc + v, 0);
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export interface ReactionContext {
  mix: Mix;
  temperature?: number;
  pH?: number;
  catalysts?: Mix;
  tags?: Record<string, number>;
}

type Condition = (ctx: ReactionContext) => number;

export class ReactionRule {
  public readonly inputs: Mix;
  public readonly outputs: Mix;
  public readonly rate: number;
  public readonly condition: Condition;

  constructor({ inputs, outputs, rate, condition }: { inputs: Mix; outputs: Mix; rate: number; condition?: Condition }) {
    this.inputs = inputs;
    this.outputs = outputs;
    this.rate = rate;
    this.condition = condition ?? (() => 1);
  }

  apply(ctx: ReactionContext, dt: number): void {
    const cond = clamp(this.condition(ctx), 0, 3);
    if (cond <= 0) return;

    let limit = Number.POSITIVE_INFINITY;
    for (const [k, need] of Object.entries(this.inputs)) {
      if (need <= 0) continue;
      const available = mixGet(ctx.mix, k);
      limit = Math.min(limit, available / need);
    }

    if (!Number.isFinite(limit) || limit <= 0) return;

    const extent = this.rate * dt * cond * limit;
    if (extent <= 0) return;

    for (const [k, need] of Object.entries(this.inputs)) {
      mixAdd(ctx.mix, k, -need * extent);
    }

    for (const [k, out] of Object.entries(this.outputs)) {
      mixAdd(ctx.mix, k, out * extent);
    }
  }
}

// Helpers for common conditions
export function temperatureWindow(lo: number, hi: number): Condition {
  return (ctx) => (ctx.temperature !== undefined && ctx.temperature >= lo && ctx.temperature <= hi ? 1 : 0);
}

export function catalystBoost(catalyst: Substance, strength: number): Condition {
  return (ctx) => {
    const boost = mixGet(ctx.catalysts ?? {}, catalyst);
    return clamp(1 + strength * boost, 0, 3);
  };
}

export function tagThreshold(tag: string, threshold: number, slope = 10): Condition {
  return (ctx) => {
    const val = ctx.tags?.[tag] ?? 0;
    // Soft transition around the threshold (sigmoid-like)
    return 1 / (1 + Math.exp(-slope * (val - threshold)));
  };
}

export interface DnaItem {
  name: string;
  mix: Mix;
  structure?: Record<string, number>;
}

export interface DnaNpc {
  name: string;
  body: Mix;
  stomach?: Mix;
  blood?: Mix;
  energy?: number;
  pain?: number;
  mood?: number;
  focus?: number;
  hunger?: number;
  thirst?: number;
  social?: number;
}

export function ingest(npc: DnaNpc, item: DnaItem, amount = 1): void {
  npc.stomach = mixMerge(npc.stomach ?? {}, mixScale(item.mix, amount));
}

export function tickMetabolism(npc: DnaNpc, reactions: ReactionRule[], dt: number): void {
  const ctx: ReactionContext = {
    mix: npc.stomach ?? {},
    temperature: mixGet(npc.body, 'TEMP'),
    pH: mixGet(npc.body, 'PH'),
    catalysts: Object.fromEntries(Object.entries(npc.body).filter(([k]) => k.startsWith('ENZ_'))),
  };

  for (const reaction of reactions) {
    reaction.apply(ctx, dt);
  }

  npc.stomach = ctx.mix;

  const absorbRate = 0.1;
  const absorbed = mixScale(npc.stomach, absorbRate * dt);
  npc.stomach = mixMerge(npc.stomach, mixScale(absorbed, -1));
  npc.body = mixMerge(npc.body, absorbed);

  deriveMacroStates(npc, dt);
}

function deriveMacroStates(npc: DnaNpc, dt: number): void {
  const glu = mixGet(npc.body, 'GLU');
  const inflam = mixGet(npc.body, 'INFLAM');
  const ser = mixGet(npc.body, 'SER');
  const water = mixGet(npc.body, 'H2O');

  npc.energy = clamp((npc.energy ?? 0.5) + (0.05 * glu - 0.03 * inflam) * dt, 0, 1);
  npc.pain = clamp((npc.pain ?? 0) + 0.06 * inflam * dt, 0, 1);
  npc.mood = clamp((npc.mood ?? 0.5) + (0.04 * ser - 0.02 * inflam) * dt, 0, 1);
  npc.hunger = clamp((npc.hunger ?? 0.5) + (0.03 - 0.06 * glu) * dt, 0, 1);
  npc.thirst = clamp((npc.thirst ?? 0.5) + (0.03 - 0.08 * water) * dt, 0, 1);
}

export function runReactor(
  itemMix: Mix,
  options: { temperature?: number; catalysts?: Mix; tags?: Record<string, number>; steps?: number; dt?: number },
  reactions: ReactionRule[],
): Mix {
  const ctx: ReactionContext = {
    mix: { ...itemMix },
    temperature: options.temperature,
    catalysts: options.catalysts,
    tags: options.tags,
  };

  const steps = options.steps ?? 10;
  const dt = options.dt ?? 1;
  for (let i = 0; i < steps; i++) {
    for (const reaction of reactions) {
      reaction.apply(ctx, dt);
    }
  }

  return ctx.mix;
}

// Example reaction set to illustrate usage. In production this would be built from your DNA grammar/table.
export const SAMPLE_REACTIONS: ReactionRule[] = [
  new ReactionRule({ inputs: { GLU: 1, O2: 1 }, outputs: { ATP: 1, CO2: 1 }, rate: 0.2 }),
  new ReactionRule({ inputs: { ATP: 1 }, outputs: {}, rate: 0.1 }),
  new ReactionRule({ inputs: { TOX_A: 1 }, outputs: { INFLAM: 1 }, rate: 0.15 }),
  new ReactionRule({ inputs: { ANT_B: 1, TOX_A: 1 }, outputs: {}, rate: 0.5 }),
  new ReactionRule({
    inputs: { D: 1, ENZ_X: 0.1 },
    outputs: { Y: 1 },
    rate: 0.25,
    condition: catalystBoost('ENZ_X', 1.5),
  }),
  new ReactionRule({ inputs: { DOCE: 1, AMARGO: 1 }, outputs: { UMAMI: 0.5 }, rate: 0.08 }),
  new ReactionRule({
    inputs: { UMAMI: 1 },
    outputs: { SER: 0.2 },
    rate: 0.05,
    condition: temperatureWindow(0.2, 0.8),
  }),
  new ReactionRule({
    inputs: { H2O: 0.5 },
    outputs: { HUMIDADE: 0.5 },
    rate: 0.05,
    condition: tagThreshold('rainfall', 0.6),
  }),
];
