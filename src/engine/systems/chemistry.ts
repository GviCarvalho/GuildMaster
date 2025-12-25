import type { MacroSnapshot, Mix, ReactionRule } from '../dna';
import { deriveMacroSnapshot, tickMetabolism } from '../dna';
import type { NPC } from '../types';

export interface ChemistryState {
  body: Mix;
  stomach: Mix;
  blood: Mix;
  lastMacro?: MacroSnapshot;
}

export function ensureChemistry(npc: NPC): ChemistryState {
  if (!npc.chemistry) {
    npc.chemistry = {
      body: { GLU: 0.5, H2O: 0.5, O2: 0.5, TEMP: 0.5, PH: 0.5 },
      stomach: {},
      blood: {},
    };
  }
  npc.chemistry.body ??= { GLU: 0.5, H2O: 0.5, O2: 0.5, TEMP: 0.5, PH: 0.5 };
  npc.chemistry.stomach ??= {};
  npc.chemistry.blood ??= {};
  return npc.chemistry as ChemistryState;
}

export function tickNpcChemistry(npc: NPC, reactions: ReactionRule[], dtSeconds: number): MacroSnapshot {
  const chemistry = ensureChemistry(npc);
  const dnaNpc = {
    name: npc.name,
    body: chemistry.body,
    stomach: chemistry.stomach,
    blood: chemistry.blood,
  };

  tickMetabolism(dnaNpc, reactions, dtSeconds);

  chemistry.body = dnaNpc.body;
  chemistry.stomach = dnaNpc.stomach ?? chemistry.stomach;
  chemistry.blood = dnaNpc.blood ?? chemistry.blood;

  const macro = deriveMacroSnapshot(chemistry.body);
  chemistry.lastMacro = macro;
  return macro;
}
