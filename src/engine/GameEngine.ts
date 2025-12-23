/**
 * Core game engine - manages game state and logic
 */

import type { GameState, Player, Quest, NPC, ReportLogEntry } from './types';

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

  constructor() {
    this.random = new Random();
    this.state = this.createInitialState();
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

    // Initialize 100 NPCs
    const npcs = this.generateInitialNPCs(100);

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
      npcs,
    };
  }

  private generateInitialNPCs(count: number): NPC[] {
    const firstNames = [
      'João',
      'Maria',
      'Pedro',
      'Ana',
      'Carlos',
      'Beatriz',
      'Lucas',
      'Julia',
      'Rafael',
      'Camila',
      'Fernando',
      'Isabela',
      'Gabriel',
      'Larissa',
      'Mateus',
      'Sofia',
      'Bruno',
      'Amanda',
      'Diego',
      'Letícia',
    ];
    const lastNames = [
      'Silva',
      'Santos',
      'Oliveira',
      'Souza',
      'Costa',
      'Ferreira',
      'Rodrigues',
      'Almeida',
      'Nascimento',
      'Lima',
    ];
    const jobs = [
      'Aventureiro',
      'Mercador',
      'Ferreiro',
      'Alquimista',
      'Guarda',
      'Caçador',
      'Minerador',
      'Pescador',
      'Agricultor',
      'Artesão',
    ];
    const traits = [
      'Corajoso',
      'Cauteloso',
      'Ganancioso',
      'Generoso',
      'Habilidoso',
      'Sortudo',
      'Trabalhador',
      'Preguiçoso',
      'Esperto',
      'Ingênuo',
    ];

    const npcs: NPC[] = [];
    for (let i = 0; i < count; i++) {
      const firstName = this.random.choice(firstNames);
      const lastName = this.random.choice(lastNames);
      const npcTraits: string[] = [];
      const traitCount = this.random.nextInt(1, 3);
      for (let j = 0; j < traitCount; j++) {
        const trait = this.random.choice(traits);
        if (!npcTraits.includes(trait)) {
          npcTraits.push(trait);
        }
      }

      npcs.push({
        id: `npc-${i + 1}`,
        name: `${firstName} ${lastName}`,
        pos: {
          x: this.random.nextInt(0, 100),
          y: this.random.nextInt(0, 100),
        },
        money: this.random.nextInt(10, 200),
        job: this.random.choice(jobs),
        traits: npcTraits,
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
      case 1: // NPC trade
        this.actionNPCTrade();
        break;
      case 2: // NPC work
        this.actionNPCWork();
        break;
      case 3: // Guild event
        this.actionGuildEvent();
        break;
      case 4: // Random encounter
        this.actionRandomEncounter();
        break;
      case 5: // Market fluctuation
        this.actionMarketFluctuation();
        break;
    }
  }

  private actionNPCMovement(): void {
    if (this.state.npcs.length === 0) return;

    const npc = this.random.choice(this.state.npcs);
    const dx = this.random.nextInt(-10, 10);
    const dy = this.random.nextInt(-10, 10);
    npc.pos.x = Math.max(0, Math.min(100, npc.pos.x + dx));
    npc.pos.y = Math.max(0, Math.min(100, npc.pos.y + dy));
    // Silent action, no report log
  }

  private actionNPCTrade(): void {
    if (this.state.npcs.length < 2) return;

    const npc1 = this.random.choice(this.state.npcs);
    const npc2 = this.random.choice(
      this.state.npcs.filter((n) => n.id !== npc1.id)
    );
    const amount = this.random.nextInt(5, 20);

    if (npc1.money >= amount) {
      npc1.money -= amount;
      npc2.money += amount;
      this.addReportLog(
        `${npc1.name} negociou ${amount} moedas com ${npc2.name}.`
      );
    }
  }

  private actionNPCWork(): void {
    if (this.state.npcs.length === 0) return;

    const npc = this.random.choice(this.state.npcs);
    const earnings = this.random.nextInt(3, 15);
    npc.money += earnings;
    this.addReportLog(`${npc.name} trabalhou como ${npc.job} e ganhou ${earnings} moedas.`);
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
    const encounters = [
      `${npc.name} encontrou uma moeda antiga no caminho.`,
      `${npc.name} ajudou um viajante perdido.`,
      `${npc.name} testemunhou um duelo na praça.`,
      `${npc.name} participou de uma festa na taverna.`,
      `${npc.name} ouviu histórias de terras distantes.`,
    ];
    const encounter = this.random.choice(encounters);
    this.addReportLog(encounter);
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
    this.state.player.gold += quest.reward;
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
        this.executeWorldActions();
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
}
