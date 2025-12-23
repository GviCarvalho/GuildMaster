/**
 * Engine module exports
 */

export { GameEngine } from './GameEngine';
export type { GameState, Player, Quest, NPC, ReportLogEntry, EntityId, ItemId, PoiId, CellId, Inventory, InventoryItem } from './types';
export { WorldIndices } from './world/indices';
export { inventoryAdd, inventoryRemove, inventorySet, inventoryGet, inventoryHas, inventoryTransfer, inventoryGetAll, inventoryClear } from './world/inventory';
export { validateIndices, logValidationResults } from './world/validation';
