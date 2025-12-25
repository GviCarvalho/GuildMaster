/**
 * Game state and core data structures
 */

import type { WorldMap, Vec2 } from './world/map';
import type { MacroSnapshot, Mix } from './dna';

export type CraftProcess = 'forge' | 'cook' | 'brew' | 'refine';
export type CraftIntent = 'tool' | 'weapon' | 'food' | 'drink' | 'medicine' | 'material';

// Phase 2: Type aliases for indices
export type EntityId = string;
export type ItemId = string;
export type PoiId = string;
export type CellId = number;

// --- Social system definitions ---
export type Caste = 'noble' | 'merchant' | 'commoner' | 'artisan';

export interface Stats {
  strength: number;
  vitality: number;
  dexterity: number;
  wisdom: number;
  intelligence: number;
  charisma: number;
}

export interface Family {
  id: string;
  surname: string;
  caste: Caste;
}
// ----------------------------------------------

// Inventory item structure
export interface InventoryItem {
  itemId: ItemId;
  quantity: number;
}

export type Inventory = Map<ItemId, number>;

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
  
  // --- Social properties ---
  familyId: string;
  caste: Caste;
  reputation: number;
  stats: Stats;
  talents: string[]; // List of special skills
  // ---------------------------

  traits: string[];
  
  // Navigation fields for pathfinding
  targetPos?: Vec2;
  currentPath?: Vec2[];
  
  // Phase 2: Inventory for trading
  inventory?: Inventory;

  // Chemistry/DNA sandbox state
  chemistry?: {
    body: Mix;
    stomach?: Mix;
    blood?: Mix;
    lastMacro?: MacroSnapshot;
  };

  learnedRecipes?: Array<{
    intent: CraftIntent;
    process: CraftProcess;
    inputSignatures: string[];
    weights?: number[];
    score: number;
  }>;

  // Phase 3: Needs system (0-100, clamped)
  needs?: {
    hunger: number;
    social: number;
    fun: number;
  };
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
  
  families: Family[]; // <-- List of generated families
  npcs: NPC[];
  
  // Phase 1: Grid-based world map
  worldMap: WorldMap;
  
  // Phase 3: Closed economy
  cityTreasury: number;
  
  // Phase 3: Relations map (sparse, nested structure)
  // Outer map: entityId -> inner map of related entities and relation values
  relations: Map<string, Map<EntityId, number>>;
  
  // Phase 3: Guild treasury (optional)
  guildTreasury?: number;
}
