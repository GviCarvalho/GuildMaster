/**
 * Game state and core data structures
 */

import type { WorldMap, Vec2 } from './world/map';

export interface Player {
  name: string;
  gold: number;
  level: number;
  experience: number;
}

export interface Quest {
  id: string;
  title: string;
  description: string;
  reward: number;
  completed: boolean;
}

export interface NPC {
  id: string;
  name: string;
  pos: { x: number; y: number };
  money: number;
  job: string;
  traits: string[];
  // Navigation fields for pathfinding
  targetPos?: Vec2;
  currentPath?: Vec2[];
}

export interface ReportLogEntry {
  timestamp: number;
  message: string;
}

export interface GameState {
  player: Player;
  quests: Quest[];
  currentTime: number;
  // WorldState fields for Phase 0 simulation
  day: number;
  timeOfDaySec: number;
  simRunning: boolean;
  reportLog: ReportLogEntry[];
  npcs: NPC[];
  // Phase 1: Grid-based world map
  worldMap: WorldMap;
}
