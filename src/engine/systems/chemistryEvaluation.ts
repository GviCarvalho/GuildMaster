import {
  deriveMacroSnapshot,
  tickMetabolism,
  type MacroSnapshot,
  type Mix,
  type ReactionRule,
  type Substance,
} from '../dna';

export interface IngestionSimulationResult {
  before: MacroSnapshot;
  after: MacroSnapshot;
  essentialDelta: Record<string, number>;
  notes: string[];
}

export function simulateIngestion(
  body: Mix,
  item: Mix,
  reactions: ReactionRule[],
  steps = 5,
  dt = 0.5,
): IngestionSimulationResult {
  const before = deriveMacroSnapshot(body);
  const working = {
    name: 'ingestion-sim',
    body: { ...body },
    stomach: { ...item },
    blood: {},
  };

  for (let i = 0; i < steps; i++) {
    tickMetabolism(working, reactions, dt);
  }

  const after = deriveMacroSnapshot(working.body);
  const essentialKeys: Substance[] = ['ATP', 'H2O', 'O2', 'GLU', 'PH', 'TEMP'];
  const essentialDelta: Record<string, number> = {};

  for (const key of essentialKeys) {
    essentialDelta[key] = (working.body[key] ?? 0) - (body[key] ?? 0);
  }

  const notes: string[] = [];
  if (essentialDelta.H2O > 0.05) notes.push('positive hydration');
  if (essentialDelta.H2O < -0.05) notes.push('reduced hydration');
  if (essentialDelta.ATP > 0.05) notes.push('increased potential energy');
  if (essentialDelta.O2 < -0.05) notes.push('oxygen consumed');
  if (essentialDelta.PH < -0.05) notes.push('acidifying tendency');
  if (essentialDelta.PH > 0.05) notes.push('alkalizing tendency');

  // TODO: future NPC learning loop can score items based on deltas and observed macro changes.
  return { before, after, essentialDelta, notes };
}
