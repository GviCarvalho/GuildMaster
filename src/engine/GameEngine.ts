/**
 * Core game engine - manages game state and logic
 */

import type {
  GameState,
  Player,
  Quest,
  NPC,
  ReportLogEntry,
  Familia,
  Casta,
  Stats,
  ItemId,
  CraftIntent,
  CraftProcess,
  PoiId,
} from './types';
import { WorldMap, type POI } from './world/map';
import { findPath, isPathValid } from './systems/pathfinding';
import { WorldIndices } from './world/indices';
import { validateIndices, logValidationResults } from './world/validation';
import { transferGold, calculateTotalGold, validateEconomyInvariants, initializeEconomy } from './systems/economy';
import { modifyNeed, satisfyNeed, syncNeedsFromMacro } from './systems/needs';
import { performSocialInteraction } from './systems/social';
import { inventoryAdd, inventoryRemove, inventoryHas } from './world/inventory';
import { tickNpcChemistry } from './systems/chemistry';
import { mixMerge, REACTIONS_BODY, REACTIONS_LIBRARY, runReactor, flattenReactions, type Mix } from './dna';
import { createSeedItemRegistry, ItemRegistry, type ItemDefinition } from './world/items';
import { mixSignature } from './world/itemAnalyzer';
import { craftOnce } from './systems/crafting';
import { simulateIngestion } from './systems/chemistryEvaluation';
import { getPoiStockpile, stockAdd, stockHas, stockPickByTag, stockRemove, type Stockpile, type StockpilesByPoi } from './world/stockpile';

// Constants for simulation
const SECONDS_PER_DAY = 1200; // 20 minutes per day
const ACTION_TICK_INTERVAL = 2000; // 2 seconds in milliseconds
const MAX_REPORT_LOG_LINES = 500;

// Simple seeded random number generator for deterministic simulation
class Random {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  choice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot choose from empty array');
    }
    return array[Math.floor(this.next() * array.length)];
  }
}

export class GameEngine {
  private state: GameState;
  private listeners: Set<(state: GameState) => void> = new Set();
  private lastActionTick: number = 0;
  private random: Random;
  // Phase 2: World indices for fast queries
  private indices: WorldIndices;
  // Phase 3: Track initial economy gold for invariant checks
  private initialEconomyGold: number = 0;
  private itemRegistry: ItemRegistry;
  private timeSinceLastItemSynthesis = 0;
  private stockpilesByPoi: StockpilesByPoi;

  constructor() {
    this.random = new Random();
    this.itemRegistry = createSeedItemRegistry();
    this.stockpilesByPoi = {};
    this.state = this.createInitialState();
    this.initializeStockpiles();
    // Initialize indices after state creation
    this.indices = new WorldIndices(this.state.worldMap.width);
    this.rebuildIndices();
    // Initialize economy and track initial gold
    initializeEconomy(this.state, 5000, 10000, this.random);
    this.initialEconomyGold = calculateTotalGold(this.state);
    console.log(`[GameEngine] Economy initialized with ${this.initialEconomyGold} total gold`);
  }

  private createInitialState(): GameState {
    const player: Player = {
      name: 'Guild Master',
      gold: 100,
      level: 1,
      experience: 0,
    };

    const quests: Quest[] = [
      {
        id: 'quest-1',
        title: 'Welcome to the Guild',
        description: 'Complete your first quest to begin your journey.',
        reward: 50,
        completed: false,
      },
      {
        id: 'quest-2',
        title: 'Gather Resources',
        description: 'Collect resources to expand your guild.',
        reward: 100,
        completed: false,
      },
    ];

    // Initialize world map (64x64) and generate city
    const worldMap = new WorldMap(64, 64);
    worldMap.generateCity();

    // 1. Gerar Famílias primeiro
    const familias = this.generateFamilies(20);

    // 2. Initialize NPCs usando as famílias
    const npcs = this.generateInitialNPCs(100, worldMap, familias);

    const reportLog: ReportLogEntry[] = [
      {
        timestamp: 0,
        message: 'Bem-vindo ao ProjectGM. A guilda está pronta para começar.',
      },
    ];

    return {
      player,
      quests,
      currentTime: 0,
      day: 1,
      timeOfDaySec: 0,
      simRunning: false,
      reportLog,
      familias, // Adiciona famílias ao estado
      npcs,
      worldMap,
      cityTreasury: 0, // Will be initialized by initializeEconomy
      relations: new Map(),
      guildTreasury: 0,
    };
  }

  private initializeStockpiles(): void {
    const catalog = this.itemRegistry.list();

    const baseSeeds: Record<string, number> = {
      wood: 30,
      stone: 30,
      ore: 18,
      fuel: 16,
      drink: 40,
      food: 34,
      organic: 14,
      balancing: 8,
      metal: 12,
    };

    const poiSeeds: Record<PoiId, Record<string, number>> = {
      'guild-hall': { ...baseSeeds },
      market: { ...baseSeeds },
      mine: { ...baseSeeds, ore: 40, metal: 20, stone: 42, fuel: 24 },
      forest: { ...baseSeeds, wood: 55, drink: 30, organic: 40 },
      tavern: { ...baseSeeds, food: 50, drink: 60, wood: 12, stone: 10 },
    };

    for (const [poiId, seeds] of Object.entries(poiSeeds)) {
      const stockpile: Stockpile = getPoiStockpile(this.stockpilesByPoi, poiId);
      for (const item of catalog) {
        if (!item.tags) continue;
        for (const tag of item.tags) {
          const qty = seeds[tag];
          if (qty) {
            stockAdd(stockpile, item.id, qty);
          }
        }
      }
    }

    // TODO: expand to regional depots/biomes and NPC logistics when maps diversify.
  }

  // Gera as famílias com castas distribuídas
  private generateFamilies(count: number): Familia[] {
    const sobrenomes = [
      'Silva', 'Cavalcanti', 'Lins', 'Holanda', 'Barros', 
      'Melo', 'Albuquerque', 'Santos', 'Oliveira', 'Souza',
      'Costa', 'Ferreira', 'Rodrigues', 'Nascimento', 'Lima'
    ];
    
    const familias: Familia[] = [];
    
    for (let i = 0; i < count; i++) {
      // Distribuição de peso: menos nobres, mais plebeus
      const rand = this.random.next();
      let casta: Casta = 'plebeu';
      
      if (rand > 0.90) casta = 'nobre';       // 10% Nobres
      else if (rand > 0.75) casta = 'comerciante'; // 15% Comerciantes
      else if (rand > 0.60) casta = 'artesao';     // 15% Artesãos
      // 60% Plebeus

      familias.push({
        id: `fam-${i}`,
        sobrenome: this.random.choice(sobrenomes),
        casta: casta
      });
    }
    return familias;
  }

  // Gera Stats baseados na Casta
  private generateStats(casta: Casta): Stats {
    // Base aleatória 3-10
    const roll = () => this.random.nextInt(3, 10);
    const stats: Stats = {
      forca: roll(), 
      vitalidade: roll(), 
      destreza: roll(),
      sabedoria: roll(), 
      inteligencia: roll(), 
      carisma: roll()
    };

    // Bônus de Casta
    switch (casta) {
      case 'nobre': 
        stats.carisma += 3; 
        stats.inteligencia += 2; 
        break;
      case 'artesao': 
        stats.destreza += 3; 
        stats.sabedoria += 1; 
        break;
      case 'plebeu': 
        stats.forca += 2; 
        stats.vitalidade += 2; 
        break;
      case 'comerciante': 
        stats.carisma += 2; 
        stats.sabedoria += 2; 
        break;
    }
    return stats;
  }

  private generateInitialNPCs(count: number, worldMap: WorldMap, familias: Familia[]): NPC[] {
    const firstNames = [
      'João', 'Maria', 'Pedro', 'Ana', 'Carlos', 'Beatriz', 
      'Lucas', 'Julia', 'Rafael', 'Camila', 'Fernando', 'Isabela', 
      'Gabriel', 'Larissa', 'Mateus', 'Sofia', 'Bruno', 'Amanda', 
      'Diego', 'Letícia',
    ];

    const traits = [
      'Corajoso', 'Cauteloso', 'Ganancioso', 'Generoso', 'Habilidoso', 
      'Sortudo', 'Trabalhador', 'Preguiçoso', 'Esperto', 'Ingênuo',
    ];

    const npcs: NPC[] = [];
    
    for (let i = 0; i < count; i++) {
      const firstName = this.random.choice(firstNames);
      
      // a) Escolher família
      const familia = this.random.choice(familias);

      // b) Gerar Stats e Reputação
      const stats = this.generateStats(familia.casta);
      const reputacao = familia.casta === 'nobre' ? 50 : 0;
      
      // c) Definir Job baseado na Casta/Stats
      let job = 'Desempregado';
      
      if (familia.casta === 'nobre') {
        job = this.random.choice(['Aristocrata', 'Político', 'Mecenas']);
      } else if (familia.casta === 'artesao' || stats.destreza > 7) {
        job = this.random.choice(['Ferreiro', 'Artesão', 'Alfaiate', 'Construtor']);
      } else if (familia.casta === 'comerciante' || stats.carisma > 7) {
        job = 'Mercador';
      } else {
        // Plebeus ou outros
        if (stats.forca > 7) job = this.random.choice(['Guarda', 'Soldado']);
        else if (stats.sabedoria > 7) job = this.random.choice(['Alquimista', 'Ervanário']);
        else if (stats.destreza > 7) job = 'Caçador';
        else job = this.random.choice(['Agricultor', 'Pescador', 'Minerador']);
      }
      
      // Definir dinheiro inicial baseado na casta
      let initialMoney = 0;
      switch(familia.casta) {
        case 'nobre': initialMoney = this.random.nextInt(300, 800); break;
        case 'comerciante': initialMoney = this.random.nextInt(100, 400); break;
        case 'artesao': initialMoney = this.random.nextInt(50, 150); break;
        default: initialMoney = this.random.nextInt(5, 50); break;
      }

      const npcTraits: string[] = [];
      const traitCount = this.random.nextInt(1, 3);
      for (let j = 0; j < traitCount; j++) {
        const trait = this.random.choice(traits);
        if (!npcTraits.includes(trait)) {
          npcTraits.push(trait);
        }
      }

      // Place NPCs on walkable tiles only
      let x = this.random.nextInt(0, worldMap.width - 1);
      let y = this.random.nextInt(0, worldMap.height - 1);
      
      // Find a walkable position
      let attempts = 0;
      while (!worldMap.isWalkable(x, y) && attempts < 100) {
        x = this.random.nextInt(0, worldMap.width - 1);
        y = this.random.nextInt(0, worldMap.height - 1);
        attempts++;
      }

      // Fallback to (0,0) which is guaranteed walkable by map generation
      if (!worldMap.isWalkable(x, y)) {
        x = 0;
        y = 0;
      }

      npcs.push({
        id: `npc-${i + 1}`,
        name: `${firstName} ${familia.sobrenome}`, // Usa sobrenome da família
        familiaId: familia.id,
        casta: familia.casta,
        reputacao: reputacao,
        stats: stats,
        talentos: [], // Futuramente implementar sorteio de talentos
        pos: { x, y },
        money: initialMoney,
        job: job,
        traits: npcTraits,
        needs: {
          hunger: this.random.nextInt(40, 60),
          social: this.random.nextInt(40, 60),
          fun: this.random.nextInt(40, 60),
        },
      });
    }

    return npcs;
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: GameState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of state change
   */
  private notify(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * Get current game state
   */
  getState(): GameState {
    return { ...this.state };
  }

  /**
   * Phase 2: Rebuild all indices from current world state
   * Can be called after loading saved state or for debugging
   */
  private rebuildIndices(): void {
    this.indices.clear();

    // Rebuild spatial index
    for (const npc of this.state.npcs) {
      this.indices.addEntityToCell(npc.id, npc.pos);
    }

    // Rebuild inventory index
    for (const npc of this.state.npcs) {
      if (npc.inventory) {
        for (const [itemId, quantity] of npc.inventory.entries()) {
          if (quantity > 0) {
            this.indices.addSeller(npc.id, itemId);
          }
        }
      }
    }

    // Debug: Log index info in development
    const debugInfo = this.indices.getDebugInfo();
    console.log('[Phase 2] Indices rebuilt:', debugInfo);
  }

  /**
   * Phase 2: Validate indices consistency (development only)
   * Can be called manually for debugging
   */
  validateIndices(): void {
    const result = validateIndices(
      this.state.npcs,
      this.indices,
      this.state.worldMap
    );
    logValidationResults(result);
  }

  /**
   * Phase 2: Get entities near a position (for witness/neighbor queries)
   */
  getEntitiesNearPosition(x: number, y: number, radius: number): NPC[] {
    const entityIds = this.indices.getEntitiesInRadius({ x, y }, radius);
    return this.state.npcs.filter((npc) => entityIds.has(npc.id));
  }

  /**
   * Phase 2: Get NPCs selling a specific item
   */
  getSellersOfItem(itemId: string): NPC[] {
    const sellerIds = this.indices.getSellersOfItem(itemId);
    return this.state.npcs.filter((npc) => sellerIds.has(npc.id));
  }

  /**
   * Start the simulation
   */
  start(): void {
    if (!this.state.simRunning) {
      this.state.simRunning = true;
      this.addReportLog('Simulação iniciada.');
      this.notify();
    }
  }

  /**
   * Stop the simulation
   */
  stop(): void {
    if (this.state.simRunning) {
      this.state.simRunning = false;
      this.addReportLog('Simulação pausada.');
      this.notify();
    }
  }

  /**
   * Toggle simulation on/off
   */
  toggle(): void {
    if (this.state.simRunning) {
      this.stop();
    } else {
      this.start();
    }
  }

  /**
   * Add entry to report log with capping
   */
  private addReportLog(message: string): void {
    this.state.reportLog.push({
      timestamp: this.state.currentTime,
      message,
    });

    // Cap log at MAX_REPORT_LOG_LINES
    if (this.state.reportLog.length > MAX_REPORT_LOG_LINES) {
      this.state.reportLog = this.state.reportLog.slice(-MAX_REPORT_LOG_LINES);
    }

    // Notify listeners of the new log entry
    this.notify();
  }

  /**
   * Execute a batch of world actions (1-8 actions)
   */
  private executeWorldActions(): void {
    const actionCount = this.random.nextInt(1, 8);

    for (let i = 0; i < actionCount; i++) {
      this.executeRandomAction();
    }
  }

  /**
   * Execute a single random world action
   */
  private executeRandomAction(): void {
    const actionType = this.random.nextInt(0, 5);

    switch (actionType) {
      case 0: // NPC movement
        this.actionNPCMovement();
        break;
      case 1: // NPC trade/buy
        this.actionNPCTrade();
        break;
      case 2: // NPC work
        this.actionNPCWork();
        break;
      case 3: // NPC eat (satisfy hunger)
        this.actionNPCEat();
        break;
      case 4: // Random encounter (social) or guild event
        if (this.random.next() < 0.5) {
          this.actionRandomEncounter();
        } else {
          this.actionGuildEvent();
        }
        break;
      case 5: // Market fluctuation
        this.actionMarketFluctuation();
        break;
    }
  }

  /**
   * Check if NPC is at a specific POI location (within footprint area)
   */
  private isNPCAtPOI(npc: NPC, poi: POI): boolean {
    const width = poi.footprint?.x || 1;
    const height = poi.footprint?.y || 1;
    
    return (
      npc.pos.x >= poi.pos.x &&
      npc.pos.x < poi.pos.x + width &&
      npc.pos.y >= poi.pos.y &&
      npc.pos.y < poi.pos.y + height
    );
  }

  private getPOIForPosition(pos: { x: number; y: number }): POI | undefined {
    return this.state.worldMap.getPOIs().find((poi) => {
      const width = poi.footprint?.x || 1;
      const height = poi.footprint?.y || 1;

      return (
        pos.x >= poi.pos.x &&
        pos.x < poi.pos.x + width &&
        pos.y >= poi.pos.y &&
        pos.y < poi.pos.y + height
      );
    });
  }

  private resolveDefaultPoiId(): PoiId {
    return (
      this.state.worldMap.getPOI('market')?.id ||
      this.state.worldMap.getPOI('guild-hall')?.id ||
      this.state.worldMap.getPOIs()[0]?.id ||
      'guild-hall'
    );
  }

  private getNpcPoi(npc: NPC): POI | undefined {
    return this.getPOIForPosition(npc.pos);
  }

  private getNpcStockpile(npc: NPC): { stockpile: Stockpile; poiId: PoiId } {
    const poi = this.getNpcPoi(npc);
    const poiId = poi?.id ?? this.resolveDefaultPoiId();
    return { stockpile: getPoiStockpile(this.stockpilesByPoi, poiId), poiId };
  }

  /**
   * Move NPC one step along its path, or set a new target if needed
   */
  private actionNPCMovement(): void {
    if (this.state.npcs.length === 0) return;

    const npc = this.random.choice(this.state.npcs);
    
    // If NPC has a current path, move along it
    if (npc.currentPath && npc.currentPath.length > 0) {
      const nextPos = npc.currentPath[0];
      
      // Verify the path is still valid
      if (!isPathValid(npc.currentPath, this.state.worldMap)) {
        // Path is blocked, recompute
        npc.currentPath = undefined;
        return;
      }

      // Phase 2: Update spatial index before moving
      const oldPos = { x: npc.pos.x, y: npc.pos.y };
      
      // Move to next position
      npc.pos = { x: nextPos.x, y: nextPos.y };
      npc.currentPath.shift();

      // Phase 2: Update spatial index after moving
      this.indices.moveEntity(npc.id, oldPos, npc.pos);

      // Check if NPC reached their target
      if (npc.currentPath.length === 0 && npc.targetPos) {
        const pois = this.state.worldMap.getPOIs();
        const targetPOI = pois.find(poi => 
          poi.pos.x === npc.targetPos!.x && poi.pos.y === npc.targetPos!.y
        );
        
        if (targetPOI) {
          this.addReportLog(`${npc.name} chegou ao ${targetPOI.name}.`);
        }
        
        npc.targetPos = undefined;
        npc.currentPath = undefined;
      }
    } else {
      // NPC doesn't have a path - occasionally set a random destination
      if (this.random.next() < 0.3) {
        const pois = this.state.worldMap.getPOIs();
        const targetPOI = this.random.choice(pois);
        
        // Only set target if not already there
        if (!this.isNPCAtPOI(npc, targetPOI)) {
          npc.targetPos = { x: targetPOI.pos.x, y: targetPOI.pos.y };
          const path = findPath(npc.pos, npc.targetPos, this.state.worldMap);
          
          if (path.length > 0) {
            npc.currentPath = path;
          } else {
            // No path found, clear target
            npc.targetPos = undefined;
          }
        }
      }
    }
  }

  private actionNPCTrade(): void {
    if (this.state.npcs.length < 2) return;

    const buyer = this.random.choice(this.state.npcs);
    const seller = this.random.choice(
      this.state.npcs.filter((n) => n.id !== buyer.id)
    );
    
    // Check if buyer is at the Market or Tavern
    const marketPOI = this.state.worldMap.getPOI('market');
    const tavernPOI = this.state.worldMap.getPOI('tavern');
    
    const buyerAtMarketOrTavern = (marketPOI && this.isNPCAtPOI(buyer, marketPOI)) || 
                                   (tavernPOI && this.isNPCAtPOI(buyer, tavernPOI));
    
    if (!buyerAtMarketOrTavern) {
      // NPC needs to move to market first
      if (marketPOI && !buyer.targetPos) {
        buyer.targetPos = { x: marketPOI.pos.x, y: marketPOI.pos.y };
        const path = findPath(buyer.pos, buyer.targetPos, this.state.worldMap);
        if (path.length > 0) {
          buyer.currentPath = path;
        } else {
          buyer.targetPos = undefined;
        }
      }
      return;
    }
    
    // Phase 3: Use closed economy - transfer gold between NPCs
    const amount = this.random.nextInt(5, 20);
    const success = transferGold(this.state, buyer.id, seller.id, amount, 'trade');
    
    if (success) {
      this.addReportLog(
        `${buyer.name} negociou ${amount} moedas com ${seller.name}.`
      );
      
      // Improve social relation through trade
      performSocialInteraction(this.state, buyer.id, seller.id, 'trade');
      
      // Satisfy hunger need slightly from trade (acquiring goods)
      satisfyNeed(buyer, 'hunger', 5);
    }
  }

  private getCraftProfileForJob(job: string):
    | { intent: CraftIntent; process: CraftProcess; requiredTags: string[][]; optionalTags?: string[][] }
    | null {
    switch (job) {
      case 'Ferreiro':
        return {
          intent: this.random.next() > 0.6 ? 'weapon' : 'tool',
          process: 'forge',
          requiredTags: [['ore', 'metal'], ['wood', 'organic'], ['fuel']],
        };
      case 'Artesão':
      case 'Alfaiate':
      case 'Construtor':
        return {
          intent: this.random.next() > 0.5 ? 'tool' : 'material',
          process: this.random.next() > 0.4 ? 'refine' : 'cook',
          requiredTags: [['wood', 'organic'], ['stone']],
          optionalTags: [['fuel']],
        };
      case 'Agricultor':
        return {
          intent: 'food',
          process: 'cook',
          requiredTags: [['food']],
          optionalTags: [['drink']],
        };
      case 'Alquimista':
      case 'Ervanário':
        return {
          intent: this.random.next() > 0.5 ? 'medicine' : 'drink',
          process: 'brew',
          requiredTags: [['organic'], ['balancing', 'stone']],
          optionalTags: [['ore', 'metal'], ['drink']],
        };
      case 'Minerador':
        return {
          intent: 'material',
          process: 'refine',
          requiredTags: [['ore', 'stone'], ['fuel']],
          optionalTags: [['wood', 'organic']],
        };
      default:
        return null;
    }
  }

  private countSelection(selections: { definition: ItemDefinition; source: 'inventory' | 'stockpile' }[], itemId: ItemId, source: 'inventory' | 'stockpile'): number {
    return selections.filter((s) => s.definition.id === itemId && s.source === source).length;
  }

  private pickIngredient(
    npc: NPC,
    tagOptions: string[],
    selections: { definition: ItemDefinition; source: 'inventory' | 'stockpile' }[],
    stockpile: Stockpile,
    allowReuse = false,
  ): { definition: ItemDefinition; source: 'inventory' | 'stockpile' } | null {
    const catalog = this.itemRegistry.list();
    const usedIds = allowReuse ? [] : selections.map((s) => s.definition.id);
    const matches = catalog.filter(
      (item) => item.tags?.some((tag) => tagOptions.includes(tag)) && !usedIds.includes(item.id),
    );

    const invPool = matches.filter((item) =>
      inventoryHas(npc, item.id, 1 + this.countSelection(selections, item.id, 'inventory')),
    );
    if (invPool.length > 0) {
      return { definition: this.random.choice(invPool), source: 'inventory' };
    }

    const stockPool = matches.filter((item) =>
      stockHas(stockpile, item.id, 1 + this.countSelection(selections, item.id, 'stockpile')),
    );
    if (stockPool.length > 0) {
      return { definition: this.random.choice(stockPool), source: 'stockpile' };
    }

    return null;
  }

  private acquireInputs(
    npc: NPC,
    requiredTags: string[][],
    optionalTags: string[][] = [],
    stockpile?: Stockpile,
  ): { definition: ItemDefinition; source: 'inventory' | 'stockpile' }[] | null {
    const selections: { definition: ItemDefinition; source: 'inventory' | 'stockpile' }[] = [];
    const targetStockpile = stockpile ?? this.getNpcStockpile(npc).stockpile;

    for (const tagOptions of requiredTags) {
      const choice = this.pickIngredient(npc, tagOptions, selections, targetStockpile);
      if (!choice) {
        return null;
      }
      selections.push(choice);
    }

    for (const tagOptions of optionalTags) {
      if (selections.length >= 3) break;
      const choice = this.pickIngredient(npc, tagOptions, selections, targetStockpile);
      if (choice) selections.push(choice);
    }

    if (selections.length < 2) {
      for (const tagOptions of requiredTags) {
        const duplicate = this.pickIngredient(npc, tagOptions, selections, targetStockpile, true);
        if (duplicate) {
          selections.push(duplicate);
          break;
        }
      }
    }

    return selections.length >= 2 ? selections : null;
  }

  private collectFromStockpile(npc: NPC, tags: string[][], stockpile: Stockpile, poiId: PoiId): void {
    const flattened = tags.flat();
    const tag = this.random.choice(flattened);
    const picked = stockPickByTag(stockpile, this.itemRegistry, tag, this.random);
    if (!picked) return;

    stockRemove(stockpile, picked.id, 1);
    inventoryAdd(npc, picked.id, 1, this.indices);
    this.addReportLog(
      `${npc.name} coletou ${picked.displayName ?? picked.name} do depósito local (${poiId}).`,
    );
  }

  private matchItemBySignature(
    npc: NPC,
    signature: string,
    selections: { definition: ItemDefinition; source: 'inventory' | 'stockpile' }[],
    stockpile: Stockpile,
  ): { definition: ItemDefinition; source: 'inventory' | 'stockpile' } | null {
    const candidates = this.itemRegistry
      .list()
      .filter((item) => item.signature === signature || mixSignature(item.mix) === signature);

    const inv = candidates.filter((item) =>
      inventoryHas(npc, item.id, 1 + this.countSelection(selections, item.id, 'inventory')),
    );
    if (inv.length > 0) {
      return { definition: this.random.choice(inv), source: 'inventory' };
    }

    const stock = candidates.filter((item) =>
      stockHas(stockpile, item.id, 1 + this.countSelection(selections, item.id, 'stockpile')),
    );
    if (stock.length > 0) {
      return { definition: this.random.choice(stock), source: 'stockpile' };
    }

    return null;
  }

  private pickLearnedRecipe(
    npc: NPC,
    intent: CraftIntent,
    process: CraftProcess,
    stockpile: Stockpile,
  ): { inputs: { definition: ItemDefinition; source: 'inventory' | 'stockpile' }[]; weights?: number[] } | null {
    const recipes = (npc.learnedRecipes ?? [])
      .filter((r) => r.intent === intent && r.process === process)
      .sort((a, b) => b.score - a.score);

    for (const recipe of recipes) {
      const selections: { definition: ItemDefinition; source: 'inventory' | 'stockpile' }[] = [];
      let valid = true;
      for (const signature of recipe.inputSignatures) {
        const choice = this.matchItemBySignature(npc, signature, selections, stockpile);
        if (!choice) {
          valid = false;
          break;
        }
        selections.push(choice);
      }

      if (valid && selections.length >= 2) {
        return { inputs: selections, weights: recipe.weights };
      }
    }

    return null;
  }

  private rememberRecipe(
    npc: NPC,
    intent: CraftIntent,
    process: CraftProcess,
    inputs: ItemDefinition[],
    weights: number[] | undefined,
    score: number,
  ): void {
    const inputSignatures = inputs.map((input) => input.signature ?? mixSignature(input.mix));
    npc.learnedRecipes ??= [];
    // TODO: allow recipe exchange between NPCs and job specializations to bias selections.

    const existing = npc.learnedRecipes.find(
      (r) =>
        r.intent === intent &&
        r.process === process &&
        r.inputSignatures.length === inputSignatures.length &&
        r.inputSignatures.every((sig, idx) => sig === inputSignatures[idx]),
    );

    if (existing) {
      if (score > existing.score) {
        existing.score = score;
        existing.weights = weights ?? existing.weights;
      }
      return;
    }

    npc.learnedRecipes.push({ intent, process, inputSignatures, weights, score });
  }

  private chooseWeights(count: number, requiredCount: number): number[] {
    const weights: number[] = [];
    for (let i = 0; i < count; i++) {
      const emphasis = i < requiredCount ? 0.5 + 0.4 * this.random.next() : 0.1 + 0.4 * this.random.next();
      weights.push(Number(emphasis.toFixed(3)));
    }
    return weights;
  }

  private scoreResult(intent: CraftIntent, npcBodyMix: Mix, craftedItem: ItemDefinition): number {
    if (intent === 'food' || intent === 'drink' || intent === 'medicine') {
      const sim = simulateIngestion(npcBodyMix, craftedItem.mix, flattenReactions(REACTIONS_LIBRARY), 20, 1);
      const energyGain = sim.after.energy - sim.before.energy;
      const hungerRelief = sim.before.hungerSignal - sim.after.hungerSignal;
      const thirstRelief = sim.before.thirstSignal - sim.after.thirstSignal;
      const essentialPenalty =
        Math.max(0, -sim.essentialDelta.ATP) +
        Math.max(0, -sim.essentialDelta.H2O) +
        Math.max(0, Math.abs(sim.essentialDelta.PH) - 0.05) +
        Math.max(0, sim.essentialDelta.O2 < -0.05 ? -sim.essentialDelta.O2 : 0);
      return energyGain * 2 + hungerRelief + thirstRelief - essentialPenalty;
    }

    const traits = craftedItem.traits ?? {};
    const slagPenalty = (craftedItem.mix.SLAG ?? 0) + (craftedItem.mix.MINERAL_DUST ?? 0);
    const stability = 1 - (traits.reactivity ?? 0);
    const metalness = traits.metalness ?? 0;
    const mineralness = traits.mineralness ?? 0;

    if (intent === 'weapon' || intent === 'tool') {
      return 1.2 * metalness + 0.8 * stability - 0.5 * slagPenalty;
    }

    return mineralness + 0.5 * stability - 0.4 * slagPenalty;
  }

  private actionNPCWork(): void {
    if (this.state.npcs.length === 0) return;

    const npc = this.random.choice(this.state.npcs);
    let profile = this.getCraftProfileForJob(npc.job);
    if (!profile) return;

    // Determine work location based on job
    let requiredPOI: POI | undefined;
    if (npc.job === 'Minerador') {
      requiredPOI = this.state.worldMap.getPOI('mine');
    } else if (npc.job === 'Caçador' || npc.job === 'Pescador' || npc.job === 'Agricultor') {
      requiredPOI = this.state.worldMap.getPOI('forest');
    } else if (npc.job === 'Mercador') {
      requiredPOI = this.state.worldMap.getPOI('market');
    }

    const currentPoi = this.getNpcPoi(npc) ?? this.state.worldMap.getPOI('market');
    const poiId = (requiredPOI ?? currentPoi)?.id ?? this.resolveDefaultPoiId();
    const stockpile = getPoiStockpile(this.stockpilesByPoi, poiId);

    const foodScarcity = this.computeLocalScarcity(poiId, 'food');
    const drinkScarcity = this.computeLocalScarcity(poiId, 'drink');
    const toolScarcity = this.computeLocalScarcity(poiId, 'tool');
    const materialScarcity = this.computeLocalScarcity(poiId, 'material');

    if (profile.intent === 'weapon' && toolScarcity > 0.6) {
      profile = { ...profile, intent: 'tool' };
    } else if (profile.intent === 'tool' || profile.intent === 'material') {
      if (toolScarcity > materialScarcity + 0.2) {
        profile = { ...profile, intent: 'tool', process: profile.process };
      } else if (materialScarcity > toolScarcity + 0.2) {
        profile = { ...profile, intent: 'material', process: profile.process };
      }
    } else if (profile.intent === 'food' && drinkScarcity > 0.65 && drinkScarcity > foodScarcity) {
      profile = { ...profile, intent: 'drink', process: 'brew', requiredTags: [['drink']] };
    }

    // Check if NPC is at required location (if any)
    if (requiredPOI && !this.isNPCAtPOI(npc, requiredPOI)) {
      // NPC needs to move to work location first
      if (!npc.targetPos) {
        npc.targetPos = { x: requiredPOI.pos.x, y: requiredPOI.pos.y };
        const path = findPath(npc.pos, npc.targetPos, this.state.worldMap);
        if (path.length > 0) {
          npc.currentPath = path;
        } else {
          npc.targetPos = undefined;
        }
      }
      return;
    }

    const learned = this.pickLearnedRecipe(npc, profile.intent, profile.process, stockpile);
    let selections = learned?.inputs ?? null;
    let weights = learned?.weights;

    if (!selections) {
      selections = this.acquireInputs(npc, profile.requiredTags, profile.optionalTags ?? [], stockpile);
      if (selections) {
        weights = this.chooseWeights(selections.length, profile.requiredTags.length);
      }
    }

    if (!selections) {
      this.collectFromStockpile(npc, profile.requiredTags, stockpile, poiId);
      return;
    }

    const inputs = selections.map((s) => s.definition);
    if (inputs.length < 2) {
      this.collectFromStockpile(npc, profile.requiredTags, stockpile, poiId);
      return;
    }

    for (const selection of selections) {
      if (selection.source === 'inventory') {
        inventoryRemove(npc, selection.definition.id, 1, this.indices);
      } else {
        stockRemove(stockpile, selection.definition.id, 1);
      }
    }

    const craftedId = craftOnce(
      this.random,
      this.itemRegistry,
      flattenReactions(REACTIONS_LIBRARY),
      inputs,
      profile.process,
      profile.process === 'forge'
        ? 'Forge product'
        : profile.process === 'refine'
          ? 'Refined material'
          : `${profile.intent} ${profile.process}`,
      weights,
    );

    stockAdd(stockpile, craftedId, 1);
    const giveToNpc = this.random.next() > 0.7;
    if (giveToNpc) {
      stockRemove(stockpile, craftedId, 1);
      inventoryAdd(npc, craftedId, 1, this.indices);
    }
    const craftedDef = this.itemRegistry.getItem(craftedId);

    if (craftedDef) {
      const score = this.scoreResult(profile.intent, npc.chemistry?.body ?? {}, craftedDef);
      if (score > 0.2) {
        this.rememberRecipe(npc, profile.intent, profile.process, inputs, weights, score);
      }

      this.addReportLog(
        `${npc.name} trabalhou como ${npc.job} e produziu ${craftedDef.displayName ?? craftedDef.name}, armazenando no POI ${poiId}.`,
      );
    }

    // Work makes you hungry
    modifyNeed(npc, 'hunger', -5);

    // Decay fun need (work is not fun)
    modifyNeed(npc, 'fun', -2);
  }

  /**
   * NPC eats food to satisfy hunger
   */
  private actionNPCEat(): void {
    if (this.state.npcs.length === 0) return;

    const npc = this.random.choice(this.state.npcs);

    const consumableCatalog = this.itemRegistry.list().filter((item) => this.isEdible(item));
    let consumed = false;
    const { stockpile, poiId } = this.getNpcStockpile(npc);
    const ownedConsumable = consumableCatalog.find((item) => inventoryHas(npc, item.id, 1));

    if (ownedConsumable) {
      const isDrink = ownedConsumable.tags?.includes('drink');
      const verb = isDrink ? 'bebeu' : 'comeu';
      inventoryRemove(npc, ownedConsumable.id, 1, this.indices);
      satisfyNeed(npc, 'hunger', 30);
      this.addReportLog(`${npc.name} ${verb} ${this.describeItem(ownedConsumable.id)}.`);
      consumed = true;
    } else {
      const availableInStock = consumableCatalog.filter((item) => stockHas(stockpile, item.id, 1));

      if (availableInStock.length > 0) {
        const picked = this.random.choice(availableInStock);
        const isDrink = picked.tags?.includes('drink');
        const verb = isDrink ? 'bebeu' : 'comeu';
        stockRemove(stockpile, picked.id, 1);
        satisfyNeed(npc, 'hunger', 25);
        this.addReportLog(`${npc.name} ${verb} ${this.describeItem(picked.id)} no ${poiId}.`);
        consumed = true;
      } else {
        const marketPOI = this.state.worldMap.getPOI('market');

        // If at market, buy food from city or another NPC
        if (marketPOI && this.isNPCAtPOI(npc, marketPOI)) {
          const scarcityTag = this.random.next() > 0.5 ? 'food' : 'drink';
          const priceMultiplier = this.getPriceMultiplier(poiId, scarcityTag);
          const foodCost = Math.round(this.random.nextInt(5, 15) * priceMultiplier);

          // Try to buy from city treasury (representing shops)
          const success = transferGold(this.state, npc.id, 'city', foodCost, 'buy food');

          if (success) {
            const purchasedFood = this.ensureProceduralItemId('alimento', (item) =>
              consumableCatalog.includes(item),
            );
            inventoryAdd(npc, purchasedFood, 1, this.indices);
            this.addReportLog(
              `${npc.name} comprou ${this.describeItem(purchasedFood)} por ${foodCost} moedas.`,
            );

            // Consume it immediately
            inventoryRemove(npc, purchasedFood, 1, this.indices);
            satisfyNeed(npc, 'hunger', 25);
            consumed = true;
          }
        } else if (marketPOI && !npc.targetPos) {
          // Move to market to buy food
          npc.targetPos = { x: marketPOI.pos.x, y: marketPOI.pos.y };
          const path = findPath(npc.pos, npc.targetPos, this.state.worldMap);
          if (path.length > 0) {
            npc.currentPath = path;
          } else {
            npc.targetPos = undefined;
          }
        }
      }
    }
    if (!consumed) {
      this.addReportLog(`${npc.name} não encontrou comida/bebida.`);
    }
  }

  private actionGuildEvent(): void {
    const events = [
      'Um novo aventureiro chegou à guilda.',
      'A guilda recebeu uma doação anônima.',
      'Um rumor de tesouros distantes circula pela taverna.',
      'O conselho da guilda se reuniu para discutir novos contratos.',
      'Comerciantes locais reportam aumento nas vendas.',
    ];
    const event = this.random.choice(events);
    this.addReportLog(event);
  }

  private actionRandomEncounter(): void {
    if (this.state.npcs.length === 0) return;

    const npc = this.random.choice(this.state.npcs);
    
    // Check if NPC is at Tavern for social encounters
    const tavernPOI = this.state.worldMap.getPOI('tavern');
    if (tavernPOI && this.isNPCAtPOI(npc, tavernPOI)) {
      // Social encounter at tavern - find another NPC nearby
      const nearbyNPCs = this.getEntitiesNearPosition(npc.pos.x, npc.pos.y, 3);
      const otherNPCs = nearbyNPCs.filter((n) => n.id !== npc.id);
      
      if (otherNPCs.length > 0) {
        const otherNPC = this.random.choice(otherNPCs);
        performSocialInteraction(this.state, npc.id, otherNPC.id, 'chat');
        
        this.addReportLog(
          `${npc.name} conversou com ${otherNPC.name} na taverna.`
        );
        
        // Satisfy social and fun needs
        satisfyNeed(npc, 'social', 10);
        satisfyNeed(npc, 'fun', 8);
        satisfyNeed(otherNPC, 'social', 10);
        satisfyNeed(otherNPC, 'fun', 8);
      } else {
        const encounters = [
          `${npc.name} participou de uma festa na taverna.`,
          `${npc.name} ouviu histórias de terras distantes.`,
        ];
        const encounter = this.random.choice(encounters);
        this.addReportLog(encounter);
        
        // Satisfy needs even if alone
        satisfyNeed(npc, 'social', 5);
        satisfyNeed(npc, 'fun', 10);
      }
    } else {
      const encounters = [
        `${npc.name} encontrou uma moeda antiga no caminho.`,
        `${npc.name} ajudou um viajante perdido.`,
        `${npc.name} testemunhou um duelo na praça.`,
      ];
      const encounter = this.random.choice(encounters);
      this.addReportLog(encounter);
      
      // Small fun increase
      satisfyNeed(npc, 'fun', 3);
    }
  }

  private computeTagQuantity(poiId: PoiId, tag: string): number {
    const stockpile = getPoiStockpile(this.stockpilesByPoi, poiId);
    let total = 0;

    for (const [itemId, qty] of Object.entries(stockpile)) {
      const def = this.itemRegistry.getItem(itemId);
      if (def?.tags?.includes(tag)) {
        total += qty;
      }
    }

    return total;
  }

  private computeLocalScarcity(poiId: PoiId, tag: string): number {
    const qty = this.computeTagQuantity(poiId, tag);
    const targetStock = 50;
    const scarcity = 1 - qty / targetStock;
    return Math.max(0, Math.min(1, scarcity));
  }

  private getPriceMultiplier(poiId: PoiId, tag: string): number {
    const scarcity = this.computeLocalScarcity(poiId, tag);
    return 1 + 1.5 * scarcity;
  }

  private actionMarketFluctuation(): void {
    const anchorPoi = this.state.worldMap.getPOI('market')?.id ?? this.resolveDefaultPoiId();
    const foodScarcity = this.computeLocalScarcity(anchorPoi, 'food');
    const drinkScarcity = this.computeLocalScarcity(anchorPoi, 'drink');
    const toolScarcity = this.computeLocalScarcity(anchorPoi, 'tool');
    const materialScarcity = this.computeLocalScarcity(anchorPoi, 'material');

    if (foodScarcity > 0.7) {
      this.addReportLog('Rumores de escassez de alimentos afetam o mercado local.');
    } else if (foodScarcity < 0.2) {
      this.addReportLog('A abundância de comida derrubou os preços esta semana.');
    } else if (drinkScarcity > 0.7) {
      this.addReportLog('Água e bebidas estão escassas e os preços subiram.');
    } else if (toolScarcity > 0.7) {
      this.addReportLog('A demanda por ferramentas aumentou com poucos estoques locais.');
    } else if (materialScarcity < 0.2) {
      this.addReportLog('Materiais refinados estão em excesso; preços em queda.');
    } else {
      const changes = [
        'Os preços dos alimentos subiram levemente.',
        'O mercado de armas está aquecido esta semana.',
        'Poções estão mais baratas devido ao excesso de estoque.',
        'A demanda por ferramentas aumentou.',
        'Rumores de escassez afetam o mercado.',
      ];
      const change = this.random.choice(changes);
      this.addReportLog(change);
    }

    // Simulate traders shifting stock between POIs when there is clear imbalance.
    this.actionTraderFlow();
  }

  private actionTraderFlow(): void {
    // TODO: replace instant transfers with caravans/pathfinding and per-storehouse routing.
    const pois = this.state.worldMap.getPOIs();
    if (pois.length < 2) return;

    const tags = ['food', 'drink', 'tool', 'material'];
    let chosen: { tag: string; from: POI; to: POI; scarcityDelta: number } | null = null;

    for (const tag of tags) {
      let richest: { poi: POI; scarcity: number } | null = null;
      let poorest: { poi: POI; scarcity: number } | null = null;

      for (const poi of pois) {
        const scarcity = this.computeLocalScarcity(poi.id, tag);
        if (!richest || scarcity < richest.scarcity) {
          richest = { poi, scarcity };
        }
        if (!poorest || scarcity > poorest.scarcity) {
          poorest = { poi, scarcity };
        }
      }

      if (richest && poorest) {
        const delta = poorest.scarcity - richest.scarcity;
        if (delta > 0.3 && this.computeTagQuantity(richest.poi.id, tag) > 0) {
          if (!chosen || delta > chosen.scarcityDelta) {
            chosen = { tag, from: richest.poi, to: poorest.poi, scarcityDelta: delta };
          }
        }
      }
    }

    if (!chosen) return;

    const sourceStock = getPoiStockpile(this.stockpilesByPoi, chosen.from.id);
    const destStock = getPoiStockpile(this.stockpilesByPoi, chosen.to.id);
    const picked = stockPickByTag(sourceStock, this.itemRegistry, chosen.tag, this.random);
    if (!picked) return;

    const transferQty = Math.max(1, Math.min(3, Math.floor((this.computeTagQuantity(chosen.from.id, chosen.tag) || 1) / 4)));
    const removed = stockRemove(sourceStock, picked.id, transferQty);
    if (!removed) return;

    stockAdd(destStock, picked.id, transferQty);
    this.addReportLog(
      `Um comerciante levou ${transferQty}x ${picked.displayName ?? picked.name} de ${chosen.from.name} para ${chosen.to.name}.`,
    );
  }

  /**
   * Complete a quest
   */
  completeQuest(questId: string): boolean {
    const quest = this.state.quests.find((q) => q.id === questId);
    if (!quest || quest.completed) {
      return false;
    }

    quest.completed = true;
    
    // Phase 3: Use transferGold for quest rewards (from guild to player)
    // If guild doesn't have enough, use city treasury as fallback
    let success = false;
    if (this.state.guildTreasury !== undefined && this.state.guildTreasury >= quest.reward) {
      success = transferGold(this.state, 'guild', 'player', quest.reward, 'quest reward');
    } else {
      success = transferGold(this.state, 'city', 'player', quest.reward, 'quest reward');
    }
    
    if (!success) {
      // Fallback: if transfer failed, just add the gold (emergency case)
      this.state.player.gold += quest.reward;
      console.warn('[Economy] Quest reward transfer failed, adding gold directly');
    }
    
    this.state.player.experience += quest.reward;

    // Level up logic
    const expNeeded = this.state.player.level * 100;
    if (this.state.player.experience >= expNeeded) {
      this.state.player.level++;
      this.state.player.experience -= expNeeded;
    }

    this.addReportLog(
      `Missão "${quest.title}" concluída! Recompensa: ${quest.reward} moedas.`
    );
    this.notify();
    return true;
  }

  /**
   * Update game time and run simulation
   */
  update(deltaTime: number): void {
    this.state.currentTime += deltaTime;

    // Only advance simulation time if running
    if (this.state.simRunning) {
      const oldTimeOfDay = Math.floor(this.state.timeOfDaySec);

      // Advance time of day
      const deltaSeconds = deltaTime / 1000;
      this.state.timeOfDaySec += deltaSeconds;

      // Check if a day has passed
      while (this.state.timeOfDaySec >= SECONDS_PER_DAY) {
        this.state.timeOfDaySec -= SECONDS_PER_DAY;
        this.state.day++;
        this.addReportLog(`--- Dia ${this.state.day} ---`);
      }

      // Notify on time changes (every second) to update the clock display
      const newTimeOfDay = Math.floor(this.state.timeOfDaySec);
      if (newTimeOfDay !== oldTimeOfDay) {
        this.notify();
      }

      // Execute action tick every 2 seconds
      if (this.state.currentTime - this.lastActionTick >= ACTION_TICK_INTERVAL) {
        this.lastActionTick = this.state.currentTime;

        // Chemistry tick informs needs instead of arbitrary decay
        this.applyChemistryTick(ACTION_TICK_INTERVAL / 1000);

        // World crafting tick: hook procedural item system into main loop
        this.maybeSynthesizeProceduralItem(ACTION_TICK_INTERVAL);

        this.executeWorldActions();
        
        // Phase 3: Validate economy invariants in development mode
        const validation = validateEconomyInvariants(this.state, this.initialEconomyGold);
        if (!validation.valid) {
          console.error('[Economy] Invariant violation detected!', validation);
        }
      }
    }
  }
  
  /**
   * Add gold to player
   */
  addGold(amount: number): void {
    this.state.player.gold += amount;
    this.notify();
  }

  /**
   * Drive DNA/metabolism per-NPC and map macro chemistry signals back to needs.
   */
  private applyChemistryTick(dtSeconds: number): void {
    for (const npc of this.state.npcs) {
      const macro = tickNpcChemistry(npc, REACTIONS_BODY, dtSeconds);
      syncNeedsFromMacro(npc, macro);
    }
  }

  private pickCatalogItem(predicate?: (item: ItemDefinition) => boolean): ItemDefinition | undefined {
    const catalog = this.itemRegistry.list();
    const pool = predicate ? catalog.filter(predicate) : catalog;
    if (pool.length === 0) return undefined;
    return this.random.choice(pool);
  }

  private synthesizeProceduralItem(labelPrefix: string): ItemId | null {
    const seed = this.pickCatalogItem();
    if (!seed) return null;

    const ambient: Mix = {
      O2: 0.5 + 0.5 * this.random.next(),
      H2O: 0.2 + 0.4 * this.random.next(),
      TEMP: 0.5 + 0.5 * this.random.next(),
    };

    const reactedMix = runReactor(
      mixMerge(seed.mix, ambient),
      {
        temperature: ambient.TEMP,
        tags: { rainfall: ambient.H2O, trust: this.random.next() },
        steps: 4,
        dt: 0.5,
      },
      flattenReactions(REACTIONS_LIBRARY),
    );

    const labelBase = labelPrefix ? `Procedural ${labelPrefix}` : 'Procedural Item';
    // Placeholder label; Analyzer will enrich procedural item names in a later pass.
    const label = labelBase.trim();
    return this.itemRegistry.spawnFromMix(label, reactedMix);
  }

  private ensureProceduralItemId(
    labelPrefix: string,
    predicate?: (item: ItemDefinition) => boolean,
  ): ItemId {
    const candidate = this.pickCatalogItem(predicate);
    if (candidate) return candidate.id;

    const synthesized = this.synthesizeProceduralItem(labelPrefix);
    if (synthesized) return synthesized;

    const fallbackMix: Mix = {
      GLU: 0.1 + 0.4 * this.random.next(),
      FRUCT: 0.05 * this.random.next(),
      H2O: 0.2 + 0.6 * this.random.next(),
    };
    return this.itemRegistry.spawnFromMix(`${labelPrefix} fallback`, fallbackMix);
  }

  private isEdible(item: ItemDefinition): boolean {
    if (!item.tags) return false;
    const isConsumable = item.tags.some((tag) => tag === 'food' || tag === 'drink');
    const clearlyInedible = item.tags.includes('ore') || item.tags.includes('metal') || item.tags.includes('stone');
    return isConsumable && !clearlyInedible;
  }

  private describeItem(itemId: ItemId): string {
    return this.itemRegistry.getItem(itemId)?.name ?? itemId;
  }

  /**
   * Periodically generate a new procedurally-reacted item and place it into the world.
   */
  private maybeSynthesizeProceduralItem(dtMs: number): void {
    this.timeSinceLastItemSynthesis += dtMs;

    // Run synthesis roughly every 10 seconds of simulation time
    if (this.timeSinceLastItemSynthesis < 10000 || this.state.npcs.length === 0) {
      return;
    }

    this.timeSinceLastItemSynthesis = 0;
    const newItemId = this.synthesizeProceduralItem('item');
    if (!newItemId) return;
    const carrier = this.random.choice(this.state.npcs);
    inventoryAdd(carrier, newItemId, 1, this.indices);

    // TODO: NPC learning could later look at tags/traits/signature to decide experiments or trades.
    this.addReportLog(
      `${carrier.name} adquiriu um novo item procedimental: ${this.describeItem(newItemId)}.`,
    );
  }

  getItemMix(itemId: ItemId): Mix | undefined {
    return this.itemRegistry.getMix(itemId);
  }

  spawnItemFromMix(name: string, mix: Mix): ItemId {
    return this.itemRegistry.spawnFromMix(name, mix);
  }
}
