/**
 * UI rendering and interaction module
 */

import type { GameState } from '../engine';

export class GameUI {
  private rootElement: HTMLElement;

  constructor(rootElement: HTMLElement) {
    this.rootElement = rootElement;
  }

  /**
   * Render the game UI based on current state
   */
  render(state: GameState, onQuestComplete: (questId: string) => void): void {
    this.rootElement.innerHTML = `
      <div style="padding: 20px; max-width: 1200px; margin: 0 auto;">
        <header style="margin-bottom: 30px;">
          <h1 style="font-size: 2.5em; margin-bottom: 10px; color: #ffd700;">
            GuildMaster
          </h1>
          <p style="font-size: 1.2em; color: #aaa;">
            Build and manage your guild
          </p>
        </header>

        <section style="margin-bottom: 30px; padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
          <h2 style="font-size: 1.8em; margin-bottom: 15px; color: #ffd700;">
            Player Stats
          </h2>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
            <div style="padding: 15px; background: rgba(255, 255, 255, 0.03); border-radius: 5px;">
              <div style="font-size: 0.9em; color: #aaa; margin-bottom: 5px;">Name</div>
              <div style="font-size: 1.3em; font-weight: bold;">${state.player.name}</div>
            </div>
            <div style="padding: 15px; background: rgba(255, 255, 255, 0.03); border-radius: 5px;">
              <div style="font-size: 0.9em; color: #aaa; margin-bottom: 5px;">Gold</div>
              <div style="font-size: 1.3em; font-weight: bold; color: #ffd700;">
                ${state.player.gold} 💰
              </div>
            </div>
            <div style="padding: 15px; background: rgba(255, 255, 255, 0.03); border-radius: 5px;">
              <div style="font-size: 0.9em; color: #aaa; margin-bottom: 5px;">Level</div>
              <div style="font-size: 1.3em; font-weight: bold; color: #00ff88;">
                ${state.player.level}
              </div>
            </div>
            <div style="padding: 15px; background: rgba(255, 255, 255, 0.03); border-radius: 5px;">
              <div style="font-size: 0.9em; color: #aaa; margin-bottom: 5px;">Experience</div>
              <div style="font-size: 1.3em; font-weight: bold; color: #00aaff;">
                ${state.player.experience} XP
              </div>
            </div>
          </div>
        </section>

        <section style="padding: 20px; background: rgba(255, 255, 255, 0.05); border-radius: 8px;">
          <h2 style="font-size: 1.8em; margin-bottom: 15px; color: #ffd700;">
            Quests
          </h2>
          <div style="display: flex; flex-direction: column; gap: 15px;">
            ${state.quests
              .map(
                (quest) => `
              <div style="padding: 20px; background: ${
                quest.completed ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255, 255, 255, 0.03)'
              }; border-radius: 5px; border-left: 4px solid ${
                quest.completed ? '#00ff88' : '#ffd700'
              };">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                  <h3 style="font-size: 1.3em; color: ${quest.completed ? '#00ff88' : '#ffd700'};">
                    ${quest.title} ${quest.completed ? '✓' : ''}
                  </h3>
                  <span style="font-size: 1.1em; color: #ffd700;">
                    ${quest.reward} 💰
                  </span>
                </div>
                <p style="color: #ccc; margin-bottom: 15px;">
                  ${quest.description}
                </p>
                ${
                  !quest.completed
                    ? `
                  <button 
                    data-quest-id="${quest.id}"
                    style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                           color: white; border: none; border-radius: 5px; font-size: 1em; 
                           cursor: pointer; font-weight: bold; transition: transform 0.2s;">
                    Complete Quest
                  </button>
                `
                    : `
                  <div style="color: #00ff88; font-weight: bold;">
                    ✓ Completed
                  </div>
                `
                }
              </div>
            `
              )
              .join('')}
          </div>
        </section>
      </div>
    `;

    // Add event listeners for quest buttons
    this.rootElement.querySelectorAll('button[data-quest-id]').forEach((button) => {
      button.addEventListener('click', (e) => {
        const questId = (e.target as HTMLButtonElement).dataset.questId;
        if (questId) {
          onQuestComplete(questId);
        }
      });
    });

    // Add hover effect to buttons
    this.rootElement.querySelectorAll('button').forEach((button) => {
      button.addEventListener('mouseenter', () => {
        (button as HTMLElement).style.transform = 'scale(1.05)';
      });
      button.addEventListener('mouseleave', () => {
        (button as HTMLElement).style.transform = 'scale(1)';
      });
    });
  }
}
