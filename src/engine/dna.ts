/**
 * Lightweight chemistry / DNA sandbox
 */

export type Substance = string;
export type Mix = Record<Substance, number>;

export const EPS = 1e-9;

/* =========================
   Mix helpers
========================= */

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

/* =========================
   Reaction system
========================= */

export interface ReactionContext {
  mix: Mix;
  temperature?: number;
  pH?: number;
  catalysts?: Mix;
  tags?: Record<string, number>;
}

type Condition = (ctx: ReactionContext) => number;

export class ReactionRule {
  readonly inputs: Mix;
  readonly outputs: Mix;
  readonly rate: number;
  readonly condition: Condition;

  constructor(opts: { inputs: Mix; outputs: Mix; rate: number; condition?: Condition }) {
    this.inputs = opts.inputs;
    this.outputs = opts.outputs;
    this.rate = opts.rate;
    this.condition = opts.condition ?? (() => 1);
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

/* =========================
   Conditions helpers
========================= */

export function temperatureWindow(lo: number, hi: number): Condition {
  return (ctx) =>
    ctx.temperature !== undefined && ctx.temperature >= lo && ctx.temperature <= hi ? 1 : 0;
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
    return 1 / (1 + Math.exp(-slope * (val - threshold)));
  };
}

/* =========================
   DNA entities
========================= */

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

/* =========================
   Metabolism
========================= */

export function ingest(npc: DnaNpc, item: DnaItem, amount = 1): void {
  npc.stomach = mixMerge(npc.stomach ?? {}, mixScale(item.mix, amount));
}

export function tickMetabolism(npc: DnaNpc, reactions: ReactionRule[], dt: number): void {
  const ctx: ReactionContext = {
    mix: npc.stomach ?? {},
    temperature: mixGet(npc.body, 'TEMP'),
    pH: mixGet(npc.body, 'PH'),
    catalysts: Object.fromEntries(
      Object.entries(npc.body).filter(([k]) => k.startsWith('ENZ_')),
    ),
  };

  for (const reaction of reactions) {
    reaction.apply(ctx, dt);
  }

  npc.stomach = ctx.mix;

  const absorbedFraction = clamp(0.1 * dt, 0, 0.5);
  const absorbed = mixScale(npc.stomach, absorbedFraction);

  npc.stomach = mixMerge(npc.stomach, mixScale(absorbed, -1));
  npc.body = mixMerge(npc.body, absorbed);

  deriveMacroStates(npc, dt);
}

function deriveMacroStates(npc: DnaNpc, dt: number): void {
  const glu = mixGet(npc.body, 'GLU');
  const atp = mixGet(npc.body, 'ATP');
  const ser = mixGet(npc.body, 'SER');
  const water = mixGet(npc.body, 'H2O');
  const o2 = mixGet(npc.body, 'O2');

  const oxidativeStress = mixGet(npc.body, 'OX_STRESS') + 0.5 * mixGet(npc.body, 'OXIDIZER');
  const hydrationLoad = Math.max(0, 0.3 - water) + mixGet(npc.body, 'DEHYDRATION_SIGNAL');
  const oxygenDebt = Math.max(0, 0.3 - o2);
  const phStress = Math.max(
    0,
    mixGet(npc.body, 'PH_ACID') + mixGet(npc.body, 'PH_BASE') + mixGet(npc.body, 'PH_SHIFT') - mixGet(npc.body, 'PH_BUFFER'),
  );
  const chelationStress = mixGet(npc.body, 'CHELATED_METAL');

  const stressChems =
    mixGet(npc.body, 'STRESS') +
    mixGet(npc.body, 'CORT') +
    mixGet(npc.body, 'ADREN') +
    oxidativeStress +
    phStress +
    hydrationLoad +
    chelationStress;

  const socialBond = mixGet(npc.body, 'SOCIAL_BOND');
  const dopa = mixGet(npc.body, 'DOPA');

  npc.energy = clamp(
    (npc.energy ?? 0.5) + (0.05 * atp + 0.02 * glu - 0.04 * oxygenDebt - 0.04 * phStress - 0.03 * hydrationLoad) * dt,
    0,
    1,
  );
  npc.pain = clamp(
    (npc.pain ?? 0) + (0.05 * oxidativeStress + 0.04 * phStress + 0.04 * hydrationLoad + 0.02 * chelationStress) * dt,
    0,
    1,
  );
  npc.mood = clamp(
    (npc.mood ?? 0.5) + (0.04 * ser - 0.02 * stressChems - 0.03 * phStress - 0.02 * hydrationLoad) * dt,
    0,
    1,
  );
  npc.focus = clamp((npc.focus ?? 0.5) + (0.04 * dopa - 0.03 * stressChems) * dt, 0, 1);
  npc.hunger = clamp((npc.hunger ?? 0.5) + (0.03 - 0.05 * glu - 0.04 * atp) * dt, 0, 1);
  npc.thirst = clamp((npc.thirst ?? 0.5) + (0.03 + 0.05 * hydrationLoad - 0.08 * water) * dt, 0, 1);
  npc.social = clamp((npc.social ?? 0.5) + (0.04 * socialBond - 0.02 * stressChems) * dt, 0, 1);
}

/* =========================
   Reactor (crafting / world)
========================= */

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

/* =========================
   Macro snapshot (read-only)
========================= */

export interface MacroSnapshot {
  energy: number;
  pain: number;
  mood: number;
  focus: number;
  hungerSignal: number;
  thirstSignal: number;
  stress: number;
}

export function deriveMacroSnapshot(body: Mix): MacroSnapshot {
  const glu = mixGet(body, 'GLU');
  const atp = mixGet(body, 'ATP');
  const ser = mixGet(body, 'SER');
  const water = mixGet(body, 'H2O');
  const o2 = mixGet(body, 'O2');

  const oxidativeStress = mixGet(body, 'OX_STRESS') + 0.5 * mixGet(body, 'OXIDIZER');
  const hydrationLoad = Math.max(0, 0.3 - water) + mixGet(body, 'DEHYDRATION_SIGNAL');
  const oxygenDebt = Math.max(0, 0.3 - o2);
  const phStress = Math.max(
    0,
    mixGet(body, 'PH_ACID') + mixGet(body, 'PH_BASE') + mixGet(body, 'PH_SHIFT') - mixGet(body, 'PH_BUFFER'),
  );
  const chelationStress = mixGet(body, 'CHELATED_METAL');

  const stressChems =
    mixGet(body, 'STRESS') +
    mixGet(body, 'CORT') +
    mixGet(body, 'ADREN') +
    oxidativeStress +
    phStress +
    hydrationLoad +
    chelationStress;
  const dopa = mixGet(body, 'DOPA');

  return {
    energy: clamp(0.5 + (0.05 * atp + 0.02 * glu - 0.04 * oxygenDebt - 0.04 * phStress - 0.03 * hydrationLoad), 0, 1),
    pain: clamp(0.05 * oxidativeStress + 0.04 * phStress + 0.04 * hydrationLoad + 0.02 * chelationStress, 0, 1),
    mood: clamp(0.5 + (0.04 * ser - 0.02 * stressChems - 0.03 * phStress - 0.02 * hydrationLoad), 0, 1),
    focus: clamp(0.5 + (0.04 * dopa - 0.03 * stressChems), 0, 1),
    hungerSignal: clamp(0.5 + (0.03 - 0.05 * glu - 0.04 * atp), 0, 1),
    thirstSignal: clamp(0.5 + (0.03 + 0.05 * hydrationLoad - 0.08 * water), 0, 1),
    stress: clamp(stressChems, 0, 1),
  };
}

/* =========================
   Reaction libraries
========================= */

export const SUBSTANCES: Substance[] = [
  // Atmosphere and basics
  'H2O',
  'O2',
  'CO2',
  'N2',
  'TEMP',
  'PH',
  'HUMIDADE',
  'D',
  'Y',

  // Homeostasis helpers
  'PH_BUFFER',
  'PH_ACID',
  'PH_BASE',
  'PH_SHIFT',
  'OXIDIZER',
  'OX_STRESS',
  'CHELATOR',
  'CHELATED_METAL',
  'DEHYDRATION_SIGNAL',

  // Minerals and geology
  'SILICA',
  'MINERAL_DUST',
  'SALT',
  'CLAY',
  'LIMESTONE',
  'ASH',

  // Metals and ores
  'IRON',
  'CARBON',
  'ORE_FE',
  'ORE_CU',
  'ORE_SN',
  'ORE_COAL',
  'ORE_AU',
  'PIG_IRON',
  'BRONZE',
  'STEEL',
  'SLAG',

  // Fuels
  'COAL',
  'CHAR',
  'OIL',

  // Biological basics
  'GLU',
  'FRUCT',
  'FIBER',
  'RESIN',
  'FAT',
  'PROTEIN',
  'AMARGO',
  'DOCE',
  'UMAMI',
  'BIO_MASS',

  // Signaling and metabolism
  'ATP',
  'SER',
  'DOPA',
  'CORT',
  'ADREN',
  'STRESS',
  'SOCIAL_BOND',
  'ENZ_X',
  'ENZ_METAL',
];

export const REACTIONS_WORLD: ReactionRule[] = [
  new ReactionRule({
    inputs: { H2O: 0.5 },
    outputs: { HUMIDADE: 0.5 },
    rate: 0.05,
    condition: tagThreshold('rainfall', 0.6),
  }),
  new ReactionRule({ inputs: { MINERAL_DUST: 1, H2O: 0.2 }, outputs: { SALT: 0.3 }, rate: 0.05 }),
];

export const REACTIONS_BODY: ReactionRule[] = [
  new ReactionRule({ inputs: { GLU: 1, O2: 1 }, outputs: { ATP: 1, CO2: 1 }, rate: 0.2 }),
  new ReactionRule({ inputs: { FRUCT: 1, O2: 1 }, outputs: { ATP: 0.8, CO2: 1 }, rate: 0.18 }),
  new ReactionRule({ inputs: { ATP: 1 }, outputs: { TEMP: 0.02 }, rate: 0.1 }),
  new ReactionRule({ inputs: { ATP: 1, OXIDIZER: 0.4 }, outputs: { OX_STRESS: 0.6, CO2: 0.4 }, rate: 0.12 }),
  new ReactionRule({ inputs: { IRON: 0.3, CHELATOR: 0.4 }, outputs: { CHELATED_METAL: 0.6 }, rate: 0.08 }),
  new ReactionRule({ inputs: { H2O: 1, SALT: 0.4 }, outputs: { DEHYDRATION_SIGNAL: 0.6 }, rate: 0.1 }),
  new ReactionRule({ inputs: { PH: 0.1, PH_ACID: 0.5 }, outputs: { PH_SHIFT: 0.5 }, rate: 0.1 }),
  new ReactionRule({ inputs: { PH: 0.1, PH_BASE: 0.5 }, outputs: { PH_SHIFT: 0.5 }, rate: 0.1 }),
  new ReactionRule({ inputs: { PH_SHIFT: 0.5, PH_BUFFER: 0.5 }, outputs: {}, rate: 0.6 }),
  new ReactionRule({ inputs: { OXIDIZER: 0.4, PH_BUFFER: 0.4 }, outputs: { OX_STRESS: 0.2 }, rate: 0.2 }),
];

export const REACTIONS_SOCIAL: ReactionRule[] = [
  new ReactionRule({
    inputs: { SER: 0.2, DOPA: 0.2 },
    outputs: { SOCIAL_BOND: 0.4 },
    rate: 0.08,
    condition: tagThreshold('trust', 0.5),
  }),
];

export const REACTIONS_LIBRARY = {
  SUBSTANCES,
  REACTIONS_WORLD,
  REACTIONS_BODY,
  REACTIONS_SOCIAL,
};

export type ReactionLibrary = typeof REACTIONS_LIBRARY;

export function flattenReactions(library: ReactionLibrary): ReactionRule[] {
  return [...library.REACTIONS_WORLD, ...library.REACTIONS_BODY, ...library.REACTIONS_SOCIAL];
}

/* Backward compatibility */
export const SAMPLE_REACTIONS: ReactionRule[] = [...REACTIONS_BODY];
