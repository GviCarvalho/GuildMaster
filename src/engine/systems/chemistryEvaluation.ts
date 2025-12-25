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
  if (essentialDelta.H2O > 0.05) notes.push('hidratação positiva');
  if (essentialDelta.H2O < -0.05) notes.push('hidratação reduzida');
  if (essentialDelta.ATP > 0.05) notes.push('energia potencial aumentada');
  if (essentialDelta.O2 < -0.05) notes.push('oxigênio consumido');
  if (essentialDelta.PH < -0.05) notes.push('tendência acidificante');
  if (essentialDelta.PH > 0.05) notes.push('tendência alcalinizante');

  // TODO: future NPC learning loop can score items based on deltas and observed macro changes.
  return { before, after, essentialDelta, notes };
}
