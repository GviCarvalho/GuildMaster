/**
 * Phase 2: Centralized inventory mutation helpers
 * 
 * All inventory changes should go through these helpers to ensure
 * indices stay consistent with entity inventories.
 */

import type { ItemId, Inventory, NPC } from '../types';
import type { WorldIndices } from './indices';

/**
 * Initialize inventory for an entity if it doesn't exist
 */
export function ensureInventory(entity: NPC): Inventory {
  if (!entity.inventory) {
    entity.inventory = new Map();
  }
  return entity.inventory;
}

/**
 * Add items to entity inventory and update indices
 * @param entity - The NPC entity
 * @param itemId - The item identifier
 * @param quantity - Amount to add (must be positive)
 * @param indices - World indices to update
 */
export function inventoryAdd(
  entity: NPC,
  itemId: ItemId,
  quantity: number,
  indices: WorldIndices
): void {
  if (quantity <= 0) {
    return;
  }

  const inventory = ensureInventory(entity);
  const oldQuantity = inventory.get(itemId) || 0;
  const newQuantity = oldQuantity + quantity;
  
  inventory.set(itemId, newQuantity);
  indices.updateSellerIndex(entity.id, itemId, newQuantity, oldQuantity);
}

/**
 * Remove items from entity inventory and update indices
 * @param entity - The NPC entity
 * @param itemId - The item identifier
 * @param quantity - Amount to remove (must be positive)
 * @param indices - World indices to update
 * @returns true if removal was successful, false if insufficient quantity
 */
export function inventoryRemove(
  entity: NPC,
  itemId: ItemId,
  quantity: number,
  indices: WorldIndices
): boolean {
  if (quantity <= 0) {
    return true;
  }

  const inventory = ensureInventory(entity);
  const oldQuantity = inventory.get(itemId) || 0;
  
  if (oldQuantity < quantity) {
    return false; // Insufficient quantity
  }

  const newQuantity = oldQuantity - quantity;
  
  if (newQuantity === 0) {
    inventory.delete(itemId);
  } else {
    inventory.set(itemId, newQuantity);
  }
  
  indices.updateSellerIndex(entity.id, itemId, newQuantity, oldQuantity);
  return true;
}

/**
 * Set item quantity in entity inventory and update indices
 * @param entity - The NPC entity
 * @param itemId - The item identifier
 * @param quantity - New quantity (must be non-negative)
 * @param indices - World indices to update
 */
export function inventorySet(
  entity: NPC,
  itemId: ItemId,
  quantity: number,
  indices: WorldIndices
): void {
  if (quantity < 0) {
    quantity = 0;
  }

  const inventory = ensureInventory(entity);
  const oldQuantity = inventory.get(itemId) || 0;
  
  if (quantity === 0) {
    inventory.delete(itemId);
  } else {
    inventory.set(itemId, quantity);
  }
  
  indices.updateSellerIndex(entity.id, itemId, quantity, oldQuantity);
}

/**
 * Get item quantity from entity inventory
 * @param entity - The NPC entity
 * @param itemId - The item identifier
 * @returns quantity of the item
 */
export function inventoryGet(entity: NPC, itemId: ItemId): number {
  if (!entity.inventory) {
    return 0;
  }
  return entity.inventory.get(itemId) || 0;
}

/**
 * Check if entity has at least a certain quantity of an item
 * @param entity - The NPC entity
 * @param itemId - The item identifier
 * @param quantity - Required quantity
 * @returns true if entity has at least the required quantity
 */
export function inventoryHas(entity: NPC, itemId: ItemId, quantity: number): boolean {
  return inventoryGet(entity, itemId) >= quantity;
}

/**
 * Transfer items between two entities
 * @param from - Source entity
 * @param to - Target entity
 * @param itemId - The item identifier
 * @param quantity - Amount to transfer
 * @param indices - World indices to update
 * @returns true if transfer was successful, false if insufficient quantity
 */
export function inventoryTransfer(
  from: NPC,
  to: NPC,
  itemId: ItemId,
  quantity: number,
  indices: WorldIndices
): boolean {
  if (quantity <= 0) {
    return true;
  }

  if (!inventoryHas(from, itemId, quantity)) {
    return false;
  }

  // Remove from source
  inventoryRemove(from, itemId, quantity, indices);
  
  // Add to target
  inventoryAdd(to, itemId, quantity, indices);
  
  return true;
}

/**
 * Get all items in entity inventory
 * @param entity - The NPC entity
 * @returns array of [itemId, quantity] pairs
 */
export function inventoryGetAll(entity: NPC): [ItemId, number][] {
  if (!entity.inventory) {
    return [];
  }
  return Array.from(entity.inventory.entries());
}

/**
 * Clear all items from entity inventory and update indices
 * @param entity - The NPC entity
 * @param indices - World indices to update
 */
export function inventoryClear(entity: NPC, indices: WorldIndices): void {
  if (!entity.inventory) {
    return;
  }

  // Update indices for all items
  for (const [itemId, oldQuantity] of entity.inventory.entries()) {
    indices.updateSellerIndex(entity.id, itemId, 0, oldQuantity);
  }

  entity.inventory.clear();
}
