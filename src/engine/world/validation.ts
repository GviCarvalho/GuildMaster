/**
 * Phase 2: Development validation for world indices
 * 
 * These functions check that indices are consistent with entity state.
 * They can be invoked during development to catch indexing bugs.
 */

import type { NPC } from '../types';
import type { WorldIndices } from './indices';
import type { WorldMap } from './map';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate that spatial indices match actual entity positions
 */
export function validateSpatialIndex(
  npcs: NPC[],
  indices: WorldIndices
): ValidationResult {
  const errors: string[] = [];

  // Build expected entity positions from actual NPC data
  const expectedCells = new Map<number, Set<string>>();
  
  for (const npc of npcs) {
    const cellId = indices.getCellId(npc.pos.x, npc.pos.y);
    let entities = expectedCells.get(cellId);
    
    if (!entities) {
      entities = new Set();
      expectedCells.set(cellId, entities);
    }
    
    entities.add(npc.id);
  }

  // Check each cell in index
  const indexCells = new Set<number>();
  
  for (const npc of npcs) {
    const cellId = indices.getCellId(npc.pos.x, npc.pos.y);
    indexCells.add(cellId);
    
    const indexedEntities = indices.getEntitiesInCell(npc.pos);
    const expectedEntities = expectedCells.get(cellId) || new Set();
    
    // Check if all expected entities are in index
    for (const entityId of expectedEntities) {
      if (!indexedEntities.has(entityId)) {
        errors.push(
          `Spatial index missing entity ${entityId} at cell (${npc.pos.x}, ${npc.pos.y})`
        );
      }
    }
    
    // Check if all indexed entities exist
    for (const entityId of indexedEntities) {
      if (!expectedEntities.has(entityId)) {
        errors.push(
          `Spatial index has extra entity ${entityId} at cell (${npc.pos.x}, ${npc.pos.y})`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate that inventory indices match actual entity inventories
 */
export function validateInventoryIndex(
  npcs: NPC[],
  indices: WorldIndices
): ValidationResult {
  const errors: string[] = [];

  // Build expected sellers from actual inventory data
  const expectedSellers = new Map<string, Set<string>>();
  
  for (const npc of npcs) {
    if (npc.inventory) {
      for (const [itemId, quantity] of npc.inventory.entries()) {
        if (quantity > 0) {
          let sellers = expectedSellers.get(itemId);
          
          if (!sellers) {
            sellers = new Set();
            expectedSellers.set(itemId, sellers);
          }
          
          sellers.add(npc.id);
        }
      }
    }
  }

  // Check that all expected sellers are indexed
  for (const [itemId, expectedSet] of expectedSellers.entries()) {
    const indexedSet = indices.getSellersOfItem(itemId);
    
    for (const entityId of expectedSet) {
      if (!indexedSet.has(entityId)) {
        errors.push(
          `Inventory index missing seller ${entityId} for item ${itemId}`
        );
      }
    }
  }

  // Check that all indexed sellers actually have the item
  for (const npc of npcs) {
    if (npc.inventory) {
      for (const [itemId, quantity] of npc.inventory.entries()) {
        const indexedSellers = indices.getSellersOfItem(itemId);
        
        if (quantity > 0 && !indexedSellers.has(npc.id)) {
          errors.push(
            `Entity ${npc.id} has item ${itemId} but is not in seller index`
          );
        }
        
        if (quantity === 0 && indexedSellers.has(npc.id)) {
          errors.push(
            `Entity ${npc.id} has 0 of item ${itemId} but is in seller index`
          );
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate all indices
 */
export function validateIndices(
  npcs: NPC[],
  indices: WorldIndices,
  _map: WorldMap
): ValidationResult {
  const spatialResult = validateSpatialIndex(npcs, indices);
  const inventoryResult = validateInventoryIndex(npcs, indices);

  return {
    valid: spatialResult.valid && inventoryResult.valid,
    errors: [...spatialResult.errors, ...inventoryResult.errors],
  };
}

/**
 * Log validation results to console (development only)
 */
export function logValidationResults(result: ValidationResult): void {
  if (result.valid) {
    console.log('✓ All indices are valid');
  } else {
    console.error('✗ Index validation failed:');
    result.errors.forEach((error) => console.error(`  - ${error}`));
  }
}
