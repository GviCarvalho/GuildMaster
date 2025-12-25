/**
 * Engine module exports
 */

export { GameEngine } from './GameEngine';
export type { GameState, Player, Quest, NPC, ReportLogEntry, EntityId, ItemId, PoiId, CellId, Inventory, InventoryItem } from './types';
export { WorldIndices } from './world/indices';
export { inventoryAdd, inventoryRemove, inventorySet, inventoryGet, inventoryHas, inventoryTransfer, inventoryGetAll, inventoryClear } from './world/inventory';
export { validateIndices, logValidationResults } from './world/validation';
export { transferGold, calculateTotalGold, validateEconomyInvariants } from './systems/economy';
export { initializeNeeds, modifyNeed, satisfyNeed, getMostUrgentNeed } from './systems/needs';
export { performSocialInteraction, getRelation } from './systems/social';
export {
  clamp,
  mixAdd,
  mixGet,
  mixMerge,
  mixScale,
  mixTotal,
  deriveMacroSnapshot,
  ReactionRule,
  runReactor,
  REACTIONS_BODY,
  REACTIONS_WORLD,
  REACTIONS_SOCIAL,
  REACTIONS_LIBRARY,
  flattenReactions,
  ReactionRule,
  runReactor,
  SAMPLE_REACTIONS,
  temperatureWindow,
  catalystBoost,
  tagThreshold,
  ingest,
  tickMetabolism,
  type MacroSnapshot,
  type DnaItem,
  type DnaNpc,
  type Mix,
  type Substance,
  type ReactionLibrary,
  } from './dna';
  export { ensureChemistry, tickNpcChemistry, type ChemistryState } from './systems/chemistry';
  export { ItemRegistry, createSeedItemRegistry } from './world/items';
