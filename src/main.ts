/**
 * Main entry point for GuildMaster game
 */
import './ui/styles.css';

import { GameEngine } from './engine';
import { GameUI } from './ui';

// Initialize the game
function initGame() {
  const appElement = document.getElementById('app');

  if (!appElement) {
    console.error('App root element not found');
    return;
  }

  // Create game engine and UI
  const engine = new GameEngine();
  const ui = new GameUI(appElement);

  // Define quest completion handler
  const handleQuestComplete = (questId: string) => {
    const success = engine.completeQuest(questId);
    if (success) {
      console.log(`Quest ${questId} completed!`);
    }
  };

  // Render initial state
  ui.render(engine.getState(), handleQuestComplete);

  // Subscribe to state changes and re-render
  engine.subscribe((state) => {
    ui.render(state, handleQuestComplete);
  });

  // Game loop for time-based updates
  let lastTime = performance.now();

  function gameLoop(currentTime: number) {
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    engine.update(deltaTime);
    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  console.log('GuildMaster game initialized!');
}

// Start the game when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
