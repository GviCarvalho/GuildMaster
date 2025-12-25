/**
 * UI rendering and interaction module
 */
import type { GameState } from '../engine';

export class GameUI {
  private rootElement: HTMLElement;
  private questCompleteHandler?: (questId: string) => void;
  private lastRenderTime: number = 0;
  private renderThrottleMs: number = 250;
  private pendingRender: boolean = false;
  private engineToggle?: () => void;

  constructor(rootElement: HTMLElement) {
    this.rootElement = rootElement;

    this.rootElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLButtonElement) {
        if (target.dataset.questId) {
          this.questCompleteHandler?.(target.dataset.questId);
        } else if (target.dataset.action === 'toggle-simulation') {
          this.engineToggle?.();
        }
      }
    });
  }

  render(
    state: GameState,
    onQuestComplete: (questId: string) => void,
    onToggleSimulation?: () => void
  ): void {
    this.questCompleteHandler = onQuestComplete;
    this.engineToggle = onToggleSimulation;

    // Throttle rendering to avoid DOM churn
    const now = performance.now();
    const timeSinceLastRender = now - this.lastRenderTime;

    if (timeSinceLastRender < this.renderThrottleMs) {
      if (!this.pendingRender) {
        this.pendingRender = true;
        setTimeout(() => {
          this.pendingRender = false;
          this.render(state, onQuestComplete, onToggleSimulation);
        }, this.renderThrottleMs - timeSinceLastRender);
      }
      return;
    }

    this.lastRenderTime = now;

    // Format time of day as HH:MM
    const hours = Math.floor(state.timeOfDaySec / 3600);
    const minutes = Math.floor((state.timeOfDaySec % 3600) / 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Button state for simulation toggle
    const btnClass = state.simRunning
      ? 'gm-action-btn gm-action-btn-active'
      : 'gm-action-btn';
    const btnTitle = state.simRunning ? 'Pause simulation' : 'Start simulation';

    this.rootElement.innerHTML = `
      <div class="gm-stage">
        <div class="gm-layout">
          <!-- Left action bar -->
          <aside class="gm-actions" aria-label="Actions">
            <button class="${btnClass}" data-action="toggle-simulation" title="${btnTitle}">🌞</button>
            <button class="gm-action-btn" data-action="quests" title="Quests">⚔️</button>
            <button class="gm-action-btn" data-action="tavern" title="Tavern">🍺</button>
            <button class="gm-action-btn" data-action="market" title="Market">🧺</button>
            <button class="gm-action-btn" data-action="settings" title="Settings">⚙️</button>
          </aside>

          <!-- Center room -->
          <main class="gm-room">
            <div class="gm-hud">
              <div class="gm-hud-card">
                <div class="gm-hud-title">Day</div>
                <div class="gm-hud-value">${state.day}</div>
              </div>

              <div class="gm-hud-card">
                <div class="gm-hud-title">Time</div>
                <div class="gm-hud-value">${timeStr}</div>
              </div>

              <div class="gm-hud-card">
                <div class="gm-hud-title">Gold</div>
                <div class="gm-hud-value gm-hud-gold">${state.player.gold} pix</div>
              </div>

              <div class="gm-hud-card">
                <div class="gm-hud-title">Guildmaster</div>
                <div class="gm-hud-value">${state.player.name}</div>
              </div>
            </div>

            <div class="gm-room-content">
              <section class="gm-card">
                <h2>Guild Hall Interior</h2>
                <div class="gm-small">
                  The "room" here is just a panel for now — later NPCs can walk behind it on a canvas layer.
                </div>
                <div style="height: 10px"></div>
                <div class="gm-list">
                  <div class="gm-quest">
                    <div class="gm-quest-title">
                      <span>📌 Status</span>
                      <span>Level ${state.player.level}</span>
                    </div>
                    <div class="gm-quest-desc">
                      Experience: ${state.player.experience} XP | NPCs: ${state.npcs.length} | ${state.simRunning ? '▶️ Running' : '⏸️ Paused'}
                    </div>
                  </div>

                  <div class="gm-quest">
                    <div class="gm-quest-title">
                      <span>🏰 Goal</span>
                      <span style="color: rgba(255,255,255,0.75)">Rebuild the Guild</span>
                    </div>
                    <div class="gm-quest-desc">
                      Sponsor adventurers, organize quests, and control the flow of gold.
                    </div>
                  </div>
                </div>
              </section>

              <section class="gm-card">
                <h2>Quest Board</h2>
                <div class="gm-scroll" style="max-height: 100%;">
                  <div class="gm-list">
                    ${state.quests
                      .slice()
                      .reverse()
                      .map((quest) => {
                        const completed = quest.completed;
                        const border = completed
                          ? 'border-left-color: rgba(0, 255, 136, 0.7);'
                          : '';
                        return `
                          <div class="gm-quest" style="${border}">
                            <div class="gm-quest-title">
                              <span>${quest.title}${completed ? ' ✓' : ''}</span>
                              <span class="gm-hud-gold">${quest.reward}💰</span>
                            </div>
                            <div class="gm-quest-desc">${quest.description}</div>
                            ${
                              !completed
                                ? `<button class="gm-quest-btn" data-quest-id="${quest.id}">Complete</button>`
                                : `<div class="gm-small" style="margin-top:8px; color: rgba(0,255,136,0.9); font-weight: 900;">✓ Completed</div>`
                            }
                          </div>
                        `;
                      })
                      .join('')}
                  </div>
                </div>
              </section>
            </div>
          </main>

          <!-- Right panels -->
          <aside class="gm-right">
            <section class="gm-card">
              <h2>Summary</h2>
              <div class="gm-small">
                Day ${state.day}, ${timeStr}. The guild has ${state.npcs.length} NPCs working and living in the city.
                ${state.simRunning ? 'The simulation is running.' : 'Click the ☀️ button to start the simulation.'}
              </div>
            </section>

            <section class="gm-card">
              <h2>Journal</h2>
              <div class="gm-scroll gm-small" id="gm-log">
                ${state.reportLog
                  .slice()
                  .reverse()
                  .map(
                    (entry) =>
                      `<div>• ${entry.message}</div>`
                  )
                  .join('')}
              </div>
            </section>
          </aside>
        </div>
      </div>
    `;
  }
}
