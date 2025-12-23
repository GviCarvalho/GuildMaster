/**
 * Core game engine - manages game state and logic
 */

import type { GameState, Player, Quest } from './types';

export class GameEngine {
  private state: GameState;
  private listeners: Set<(state: GameState) => void> = new Set();

  constructor() {
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

    return {
      player,
      quests,
      currentTime: 0,
    };
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

    this.notify();
    return true;
  }

  /**
   * Update game time
   */
  update(deltaTime: number): void {
    this.state.currentTime += deltaTime;
    this.notify();
  }

  /**
   * Add gold to player
   */
  addGold(amount: number): void {
    this.state.player.gold += amount;
    this.notify();
  }
}
