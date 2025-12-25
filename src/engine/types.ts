/**
 * Game state and core data structures
 */

import type { WorldMap, Vec2 } from './world/map';
import type { MacroSnapshot, Mix } from './dna';

// Phase 2: Type aliases for indices
export type EntityId = string;
export type ItemId = string;
export type PoiId = string;
export type CellId = number;

// --- Novas definições para o sistema social ---
export type Casta = 'nobre' | 'comerciante' | 'plebeu' | 'artesao';

export interface Stats {
  forca: number;
  vitalidade: number;
  destreza: number;
  sabedoria: number;
  inteligencia: number;
  carisma: number;
}

export interface Familia {
  id: string;
  sobrenome: string;
  casta: Casta;
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
  
  // --- Propriedades Sociais ---
  familiaId: string;
  casta: Casta;
  reputacao: number;
  stats: Stats;
  talentos: string[]; // Lista de habilidades especiais
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
  
  familias: Familia[]; // <-- Lista de famílias geradas
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
