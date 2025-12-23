/**
 * Phase 3: Social system for NPC relations
 * 
 * This module manages relationships between NPCs.
 * Relations are stored in a sparse map with values typically between -100 and 100.
 */

import type { GameState, EntityId } from '../types';

/**
 * Get relation value between two entities
 * Returns 0 if no relation exists (neutral)
 */
export function getRelation(
  state: GameState,
  entityId1: EntityId,
  entityId2: EntityId
): number {
  if (!state.relations) {
    return 0;
  }
  
  // Search through the map
  for (const [mapKey, innerMap] of state.relations.entries()) {
    if (mapKey === entityId1 || mapKey === entityId2) {
      const otherId = mapKey === entityId1 ? entityId2 : entityId1;
      return innerMap.get(otherId) || 0;
    }
  }
  
  return 0;
}

/**
 * Set relation value between two entities
 * Value is typically clamped between -100 and 100
 */
export function setRelation(
  state: GameState,
  entityId1: EntityId,
  entityId2: EntityId,
  value: number
): void {
  // Clamp value
  value = Math.max(-100, Math.min(100, value));
  
  // Ensure relations map exists
  if (!state.relations) {
    state.relations = new Map();
  }
  
  // Get or create inner map for entityId1
  let innerMap = state.relations.get(entityId1);
  if (!innerMap) {
    innerMap = new Map();
    state.relations.set(entityId1, innerMap);
  }
  
  // Set the relation
  innerMap.set(entityId2, value);
  
  // Also set the reverse relation for symmetry
  let reverseMap = state.relations.get(entityId2);
  if (!reverseMap) {
    reverseMap = new Map();
    state.relations.set(entityId2, reverseMap);
  }
  reverseMap.set(entityId1, value);
}

/**
 * Modify relation value between two entities by a delta
 */
export function modifyRelation(
  state: GameState,
  entityId1: EntityId,
  entityId2: EntityId,
  delta: number
): void {
  const currentValue = getRelation(state, entityId1, entityId2);
  setRelation(state, entityId1, entityId2, currentValue + delta);
}

/**
 * Check if two entities have a positive relationship
 */
export function areFriendly(
  state: GameState,
  entityId1: EntityId,
  entityId2: EntityId,
  threshold: number = 20
): boolean {
  return getRelation(state, entityId1, entityId2) >= threshold;
}

/**
 * Check if two entities have a negative relationship
 */
export function areHostile(
  state: GameState,
  entityId1: EntityId,
  entityId2: EntityId,
  threshold: number = -20
): boolean {
  return getRelation(state, entityId1, entityId2) <= threshold;
}

/**
 * Perform a social interaction between two NPCs
 * Updates their relationship based on the interaction type
 * 
 * @param state Game state
 * @param npc1Id First NPC
 * @param npc2Id Second NPC
 * @param interactionType Type of interaction
 * @returns Relation delta applied
 */
export function performSocialInteraction(
  state: GameState,
  npc1Id: EntityId,
  npc2Id: EntityId,
  interactionType: 'chat' | 'trade' | 'conflict' | 'help'
): number {
  let delta = 0;
  
  switch (interactionType) {
    case 'chat':
      delta = 2; // Small positive increase
      break;
    case 'trade':
      delta = 5; // Moderate positive increase
      break;
    case 'conflict':
      delta = -10; // Negative decrease
      break;
    case 'help':
      delta = 8; // Large positive increase
      break;
  }
  
  // Apply some randomness (-1 to +1)
  delta += Math.random() * 2 - 1;
  
  modifyRelation(state, npc1Id, npc2Id, delta);
  
  return delta;
}

/**
 * Get all entities that have a relationship with the given entity
 */
export function getRelatedEntities(
  state: GameState,
  entityId: EntityId
): Array<{ entityId: EntityId; relation: number }> {
  if (!state.relations) {
    return [];
  }
  
  const innerMap = state.relations.get(entityId);
  if (!innerMap) {
    return [];
  }
  
  const result: Array<{ entityId: EntityId; relation: number }> = [];
  for (const [otherId, relation] of innerMap.entries()) {
    result.push({ entityId: otherId, relation });
  }
  
  return result;
}
