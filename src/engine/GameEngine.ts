/**
 * Core game engine - manages game state and logic
 */

import type { GameState, Player, Quest, NPC, ReportLogEntry, Familia, Casta, Stats, ItemId } from './types';
import { WorldMap, type POI } from './world/map';
import { findPath, isPathValid } from './systems/pathfinding';
import { WorldIndices } from './world/indices';
import { validateIndices, logValidationResults } from './world/validation';
import { transferGold, calculateTotalGold, validateEconomyInvariants, initializeEconomy } from './systems/economy';
import { modifyNeed, satisfyNeed, syncNeedsFromMacro } from './systems/needs';
import { performSocialInteraction } from './systems/social';
import { inventoryAdd, inventoryRemove, inventoryHas } from './world/inventory';
import { tickNpcChemistry } from './systems/chemistry';
import { REACTIONS_BODY, type Mix } from './dna';
import { createSeedItemRegistry, ItemRegistry } from './world/items';

// Constants for simulation
const SECONDS_PER_DAY = 1200; // 20 minutes per day
const ACTION_TICK_INTERVAL = 2000; // 2 seconds in milliseconds
const MAX_REPORT_LOG_LINES = 500;

// Constants for tempo (time resource) economy
const MIN_TEMPO_GENERATION = 3;
const MAX_TEMPO_GENERATION = 8;

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

  constructor() {
    this.random = new Random();
    this.itemRegistry = createSeedItemRegistry();
    this.state = this.createInitialState();
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

  private actionNPCWork(): void {
    if (this.state.npcs.length === 0) return;

    const npc = this.random.choice(this.state.npcs);
    
    // Determine work location based on job
    let requiredPOI: POI | undefined;
    if (npc.job === 'Minerador') {
      requiredPOI = this.state.worldMap.getPOI('mine');
    } else if (npc.job === 'Caçador' || npc.job === 'Pescador' || npc.job === 'Agricultor') {
      requiredPOI = this.state.worldMap.getPOI('forest');
    } else if (npc.job === 'Mercador') {
      requiredPOI = this.state.worldMap.getPOI('market');
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
    
    // Phase 3: Work produces items by consuming input (tempo or insumo)
    // No gold generation from work
    const inputItem = 'tempo';
    const outputItem = this.getJobOutputItem(npc.job);
    
    // Ensure NPC has "tempo" resource - initialize if needed
    if (!inventoryHas(npc, inputItem, 1)) {
      inventoryAdd(npc, inputItem, this.random.nextInt(MIN_TEMPO_GENERATION, MAX_TEMPO_GENERATION), this.indices);
    }
    
    // Consume tempo and produce output item
    const hasInput = inventoryHas(npc, inputItem, 1);
    if (hasInput) {
      inventoryRemove(npc, inputItem, 1, this.indices);
      inventoryAdd(npc, outputItem, 1, this.indices);
      
      this.addReportLog(`${npc.name} trabalhou como ${npc.job} e produziu ${outputItem}.`);
      
      // Work makes you hungry
      modifyNeed(npc, 'hunger', -5);
      
      // Decay fun need (work is not fun)
      modifyNeed(npc, 'fun', -2);
    } else {
      this.addReportLog(`${npc.name} não pôde trabalhar (sem tempo disponível).`);
    }
  }
  
  /**
   * Get output item for a job
   */
  private getJobOutputItem(job: string): string {
    const jobOutputs: Record<string, string> = {
      'Minerador': 'minério',
      'Caçador': 'carne',
      'Pescador': 'peixe',
      'Agricultor': 'grãos',
      'Mercador': 'mercadoria',
      'Ferreiro': 'ferramenta',
      'Alquimista': 'poção',
      'Artesão': 'artesanato',
      'Guarda': 'segurança',
      'Aventureiro': 'tesouro',
    };
    
    return jobOutputs[job] || 'item';
  }

  /**
   * NPC eats food to satisfy hunger
   */
  private actionNPCEat(): void {
    if (this.state.npcs.length === 0) return;

    const npc = this.random.choice(this.state.npcs);
    
    // Look for food items in inventory
    const foodItems = ['carne', 'peixe', 'grãos', 'comida'];
    let foundFood = false;
    
    for (const foodItem of foodItems) {
      if (inventoryHas(npc, foodItem, 1)) {
        // Consume food
        inventoryRemove(npc, foodItem, 1, this.indices);
        
        // Satisfy hunger significantly
        satisfyNeed(npc, 'hunger', 30);
        
        this.addReportLog(`${npc.name} comeu ${foodItem}.`);
        foundFood = true;
        break;
      }
    }
    
    // If no food found, try to buy some at the market
    if (!foundFood) {
      const marketPOI = this.state.worldMap.getPOI('market');
      
      // If at market, buy food from city or another NPC
      if (marketPOI && this.isNPCAtPOI(npc, marketPOI)) {
        const foodCost = this.random.nextInt(5, 15);
        
        // Try to buy from city treasury (representing shops)
        const success = transferGold(this.state, npc.id, 'city', foodCost, 'buy food');
        
        if (success) {
          // Add food to inventory
          inventoryAdd(npc, 'comida', 1, this.indices);
          this.addReportLog(`${npc.name} comprou comida por ${foodCost} moedas.`);
          
          // Consume it immediately
          inventoryRemove(npc, 'comida', 1, this.indices);
          satisfyNeed(npc, 'hunger', 25);
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

  private actionMarketFluctuation(): void {
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

  getItemMix(itemId: ItemId): Mix | undefined {
    return this.itemRegistry.getMix(itemId);
  }

  spawnItemFromMix(name: string, mix: Mix): ItemId {
    return this.itemRegistry.spawnFromMix(name, mix);
  }
}
