/**
 * Phase 3: Movement system
 * 
 * This module provides utilities for NPC movement including
 * greedy pathfinding towards targets.
 */

import type { NPC } from '../types';
import type { Vec2, WorldMap } from '../world/map';

/**
 * Calculate Manhattan distance between two positions
 */
export function manhattanDistance(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Calculate Euclidean distance between two positions
 */
export function euclideanDistance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Check if two positions are adjacent (within 1 tile Manhattan distance)
 */
export function areAdjacent(a: Vec2, b: Vec2): boolean {
  return manhattanDistance(a, b) === 1;
}

/**
 * Check if two positions are the same
 */
export function positionsEqual(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Greedy movement: take one step towards target
 * Moves to the walkable neighbor that minimizes distance to target
 * 
 * @param npc NPC to move
 * @param target Target position
 * @param map World map
 * @returns true if NPC moved, false if no valid move
 */
export function greedyStepTowards(npc: NPC, target: Vec2, map: WorldMap): boolean {
  // If already at target, don't move
  if (positionsEqual(npc.pos, target)) {
    return false;
  }
  
  // Check 4 cardinal directions
  const directions = [
    { x: 0, y: -1 }, // Up
    { x: 0, y: 1 },  // Down
    { x: -1, y: 0 }, // Left
    { x: 1, y: 0 },  // Right
  ];
  
  let bestPos: Vec2 | null = null;
  let bestDistance = manhattanDistance(npc.pos, target);
  
  for (const dir of directions) {
    const newPos: Vec2 = {
      x: npc.pos.x + dir.x,
      y: npc.pos.y + dir.y,
    };
    
    // Check if position is walkable
    if (map.isWalkable(newPos.x, newPos.y)) {
      const distance = manhattanDistance(newPos, target);
      
      // Update best position if this is closer
      if (distance < bestDistance) {
        bestDistance = distance;
        bestPos = newPos;
      }
    }
  }
  
  // Move to best position if found
  if (bestPos) {
    npc.pos = bestPos;
    return true;
  }
  
  return false;
}

/**
 * Check if NPC is within a certain distance of a target
 */
export function isNearTarget(npc: NPC, target: Vec2, maxDistance: number): boolean {
  return manhattanDistance(npc.pos, target) <= maxDistance;
}

/**
 * Find the closest position from a list of positions
 */
export function findClosestPosition(from: Vec2, positions: Vec2[]): Vec2 | null {
  if (positions.length === 0) {
    return null;
  }
  
  let closest = positions[0];
  let minDistance = manhattanDistance(from, closest);
  
  for (let i = 1; i < positions.length; i++) {
    const distance = manhattanDistance(from, positions[i]);
    if (distance < minDistance) {
      minDistance = distance;
      closest = positions[i];
    }
  }
  
  return closest;
}
