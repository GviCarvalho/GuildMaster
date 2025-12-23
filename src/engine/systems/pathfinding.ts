/**
 * A* pathfinding system for grid-based navigation
 */

import type { WorldMap, Vec2 } from '../world/map';

interface PathNode {
  pos: Vec2;
  parent: PathNode | null;
  g: number; // Cost from start
  h: number; // Heuristic to goal
  f: number; // Total cost (g + h)
}

/**
 * Manhattan distance heuristic for 4-directional movement
 */
function manhattanDistance(a: Vec2, b: Vec2): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Check if two positions are equal
 */
function posEquals(a: Vec2, b: Vec2): boolean {
  return a.x === b.x && a.y === b.y;
}

/**
 * Create a unique key for a position
 */
function posKey(pos: Vec2): string {
  return `${pos.x},${pos.y}`;
}

/**
 * Find path from start to goal using A* algorithm
 * @param start Starting position
 * @param goal Goal position
 * @param map World map with tile information
 * @returns Array of positions representing the path, or empty array if no path found
 */
export function findPath(start: Vec2, goal: Vec2, map: WorldMap): Vec2[] {
  // If start equals goal, return empty path
  if (posEquals(start, goal)) {
    return [];
  }

  // If goal is not walkable, return empty path
  if (!map.isWalkable(goal.x, goal.y)) {
    return [];
  }

  const openSet = new Map<string, PathNode>();
  const closedSet = new Set<string>();

  // Initialize start node
  const startNode: PathNode = {
    pos: start,
    parent: null,
    g: 0,
    h: manhattanDistance(start, goal),
    f: manhattanDistance(start, goal),
  };

  openSet.set(posKey(start), startNode);

  // 4-directional movement (up, down, left, right)
  const directions = [
    { x: 0, y: -1 }, // Up
    { x: 0, y: 1 },  // Down
    { x: -1, y: 0 }, // Left
    { x: 1, y: 0 },  // Right
  ];

  while (openSet.size > 0) {
    // Find node with lowest f score
    let current: PathNode | null = null;
    let lowestF = Infinity;

    for (const node of openSet.values()) {
      if (node.f < lowestF) {
        lowestF = node.f;
        current = node;
      }
    }

    if (!current) {
      break;
    }

    // Check if we reached the goal
    if (posEquals(current.pos, goal)) {
      return reconstructPath(current);
    }

    // Move current from open to closed
    const currentKey = posKey(current.pos);
    openSet.delete(currentKey);
    closedSet.add(currentKey);

    // Check all neighbors
    for (const dir of directions) {
      const neighborPos = {
        x: current.pos.x + dir.x,
        y: current.pos.y + dir.y,
      };

      const neighborKey = posKey(neighborPos);

      // Skip if already evaluated or not walkable
      if (closedSet.has(neighborKey)) {
        continue;
      }

      if (!map.isWalkable(neighborPos.x, neighborPos.y)) {
        continue;
      }

      // Calculate costs
      const tentativeG = current.g + 1; // Cost of 1 for each step

      const existingNode = openSet.get(neighborKey);

      if (existingNode) {
        // If we found a better path to this node, update it
        if (tentativeG < existingNode.g) {
          existingNode.parent = current;
          existingNode.g = tentativeG;
          existingNode.f = tentativeG + existingNode.h;
        }
      } else {
        // Add new node to open set
        const h = manhattanDistance(neighborPos, goal);
        const newNode: PathNode = {
          pos: neighborPos,
          parent: current,
          g: tentativeG,
          h: h,
          f: tentativeG + h,
        };
        openSet.set(neighborKey, newNode);
      }
    }
  }

  // No path found
  return [];
}

/**
 * Reconstruct path from goal node by following parent pointers
 */
function reconstructPath(node: PathNode): Vec2[] {
  const path: Vec2[] = [];
  let current: PathNode | null = node;

  while (current !== null) {
    path.unshift(current.pos);
    current = current.parent;
  }

  // Remove the start position (NPC is already there)
  if (path.length > 0) {
    path.shift();
  }

  return path;
}

/**
 * Check if a path is still valid (all tiles are still walkable)
 */
export function isPathValid(path: Vec2[], map: WorldMap): boolean {
  for (const pos of path) {
    if (!map.isWalkable(pos.x, pos.y)) {
      return false;
    }
  }
  return true;
}
