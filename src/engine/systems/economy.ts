/**
 * Phase 3: Economy system with closed economy and gold tracking
 * 
 * This module provides gold transfer mechanisms and invariant validation
 * to ensure total gold in the economy remains constant.
 */

import type { NPC, GameState, EntityId } from '../types';

/**
 * Entity that can hold gold (NPC, player, city, or guild)
 */
export type GoldHolder = 'city' | 'guild' | 'player' | EntityId;

/**
 * Transfer gold between entities in a closed economy
 * This is the single pathway for all gold transfers
 * 
 * @param state Game state
 * @param from Source entity (NPC id, 'city', 'guild', or 'player')
 * @param to Target entity (NPC id, 'city', 'guild', or 'player')
 * @param amount Amount of gold to transfer (must be positive)
 * @param reason Description of the transfer for logging
 * @returns true if transfer was successful, false if insufficient funds
 */
export function transferGold(
  state: GameState,
  from: GoldHolder,
  to: GoldHolder,
  amount: number,
  _reason: string
): boolean {
  if (amount <= 0) {
    return true;
  }

  // Get current balances
  const fromBalance = getGoldBalance(state, from);
  const toBalance = getGoldBalance(state, to);

  // Check if source has enough gold
  if (fromBalance < amount) {
    return false;
  }

  // Perform transfer
  setGoldBalance(state, from, fromBalance - amount);
  setGoldBalance(state, to, toBalance + amount);

  return true;
}

/**
 * Get gold balance for an entity
 */
function getGoldBalance(state: GameState, holder: GoldHolder): number {
  if (holder === 'city') {
    return state.cityTreasury;
  } else if (holder === 'guild') {
    return state.guildTreasury || 0;
  } else if (holder === 'player') {
    return state.player.gold;
  } else {
    // Find NPC by ID
    const npc = state.npcs.find((n) => n.id === holder);
    return npc ? npc.money : 0;
  }
}

/**
 * Set gold balance for an entity
 */
function setGoldBalance(state: GameState, holder: GoldHolder, amount: number): void {
  if (holder === 'city') {
    state.cityTreasury = amount;
  } else if (holder === 'guild') {
    if (state.guildTreasury !== undefined) {
      state.guildTreasury = amount;
    }
  } else if (holder === 'player') {
    state.player.gold = amount;
  } else {
    // Find NPC by ID
    const npc = state.npcs.find((n) => n.id === holder);
    if (npc) {
      npc.money = amount;
    }
  }
}

/**
 * Calculate total gold in the economy
 */
export function calculateTotalGold(state: GameState): number {
  let total = state.cityTreasury;
  
  if (state.guildTreasury !== undefined) {
    total += state.guildTreasury;
  }
  
  total += state.player.gold;
  
  for (const npc of state.npcs) {
    total += npc.money;
  }
  
  return total;
}

/**
 * Validate economy invariants (development mode)
 * Check that total gold remains constant
 */
export function validateEconomyInvariants(
  state: GameState,
  expectedTotal: number
): { valid: boolean; actual: number; expected: number; diff: number } {
  const actualTotal = calculateTotalGold(state);
  const diff = actualTotal - expectedTotal;
  const valid = Math.abs(diff) < 0.01; // Allow for floating point errors
  
  if (!valid) {
    console.error(`[Economy] Gold mismatch! Expected: ${expectedTotal}, Actual: ${actualTotal}, Diff: ${diff}`);
  }
  
  return {
    valid,
    actual: actualTotal,
    expected: expectedTotal,
    diff,
  };
}

/**
 * Initialize economy with distributed gold
 * Called during world generation
 * 
 * @param state Game state
 * @param cityTreasuryMin Minimum city treasury (5000-10000)
 * @param cityTreasuryMax Maximum city treasury
 * @param random Random number generator
 */
export function initializeEconomy(
  state: GameState,
  cityTreasuryMin: number,
  cityTreasuryMax: number,
  random: { nextInt: (min: number, max: number) => number }
): void {
  // Initialize city treasury
  state.cityTreasury = random.nextInt(cityTreasuryMin, cityTreasuryMax);
  
  // Initialize guild treasury (optional)
  if (state.guildTreasury !== undefined) {
    state.guildTreasury = 0;
  }
  
  // Note: NPC gold is already initialized in GameEngine.generateInitialNPCs
  // Player gold is already initialized in GameEngine.createInitialState
  
  console.log(`[Economy] Initialized with city treasury: ${state.cityTreasury} gold`);
  console.log(`[Economy] Total economy gold: ${calculateTotalGold(state)} gold`);
}

/**
 * Work action: consume input item, produce output item
 * No gold generation from work
 * 
 * @param npc NPC performing work
 * @param inputItem Item consumed by work (e.g., "tempo")
 * @param outputItem Item produced by work
 * @param inputQuantity Quantity of input item consumed
 * @param outputQuantity Quantity of output item produced
 * @param hasInput Whether NPC has the input item
 * @param inventoryAdd Function to add items to inventory
 * @param inventoryRemove Function to remove items from inventory
 * @returns true if work was successful
 */
export function performWork(
  npc: NPC,
  inputItem: string,
  outputItem: string,
  inputQuantity: number,
  outputQuantity: number,
  hasInput: boolean,
  inventoryAdd: (entity: NPC, itemId: string, quantity: number) => void,
  inventoryRemove: (entity: NPC, itemId: string, quantity: number) => boolean
): boolean {
  // Check if NPC has input item (if required)
  if (inputQuantity > 0 && !hasInput) {
    return false;
  }
  
  // Consume input item
  if (inputQuantity > 0) {
    const success = inventoryRemove(npc, inputItem, inputQuantity);
    if (!success) {
      return false;
    }
  }
  
  // Produce output item
  inventoryAdd(npc, outputItem, outputQuantity);
  
  return true;
}
