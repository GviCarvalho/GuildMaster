/**
 * Game state and core data structures
 */

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

export interface GameState {
  player: Player;
  quests: Quest[];
  currentTime: number;
}
