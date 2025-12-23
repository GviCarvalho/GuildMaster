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
        } else if (target.dataset.action === 'passar-dia') {
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
    if (now - this.lastRenderTime < this.renderThrottleMs && this.pendingRender) {
      return;
    }

    if (now - this.lastRenderTime < this.renderThrottleMs) {
      if (!this.pendingRender) {
        this.pendingRender = true;
        setTimeout(() => {
          this.pendingRender = false;
          this.render(state, onQuestComplete, onToggleSimulation);
        }, this.renderThrottleMs - (now - this.lastRenderTime));
      }
      return;
    }

    this.lastRenderTime = now;

    // Format time of day as HH:MM
    const hours = Math.floor(state.timeOfDaySec / 3600);
    const minutes = Math.floor((state.timeOfDaySec % 3600) / 60);
    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

    // Button state for passar-dia
    const btnClass = state.simRunning
      ? 'gm-action-btn gm-action-btn-active'
      : 'gm-action-btn';
    const btnTitle = state.simRunning ? 'Pausar simulação' : 'Iniciar simulação';

    this.rootElement.innerHTML = `
      <div class="gm-stage">
        <div class="gm-layout">
          <!-- Left action bar -->
          <aside class="gm-actions" aria-label="Ações">
            <button class="${btnClass}" data-action="passar-dia" title="${btnTitle}">🌞</button>
            <button class="gm-action-btn" data-action="missoes" title="Missões">⚔️</button>
            <button class="gm-action-btn" data-action="taverna" title="Taverna">🍺</button>
            <button class="gm-action-btn" data-action="mercado" title="Mercado">🧺</button>
            <button class="gm-action-btn" data-action="config" title="Configurações">⚙️</button>
          </aside>

          <!-- Center room -->
          <main class="gm-room">
            <div class="gm-hud">
              <div class="gm-hud-card">
                <div class="gm-hud-title">Dia</div>
                <div class="gm-hud-value">${state.day}</div>
              </div>

              <div class="gm-hud-card">
                <div class="gm-hud-title">Hora</div>
                <div class="gm-hud-value">${timeStr}</div>
              </div>

              <div class="gm-hud-card">
                <div class="gm-hud-title">Ouro</div>
                <div class="gm-hud-value gm-hud-gold">${state.player.gold} pix</div>
              </div>

              <div class="gm-hud-card">
                <div class="gm-hud-title">Mestre</div>
                <div class="gm-hud-value">${state.player.name}</div>
              </div>
            </div>

            <div class="gm-room-content">
              <section class="gm-card">
                <h2>Interior da Guilda</h2>
                <div class="gm-small">
                  A "sala" aqui é só um painel por enquanto — mais tarde dá pra colocar NPCs andando (canvas) por trás.
                </div>
                <div style="height: 10px"></div>
                <div class="gm-list">
                  <div class="gm-quest">
                    <div class="gm-quest-title">
                      <span>📌 Status</span>
                      <span>Nível ${state.player.level}</span>
                    </div>
                    <div class="gm-quest-desc">
                      Experiência: ${state.player.experience} XP | NPCs: ${state.npcs.length} | ${state.simRunning ? '▶️ Simulando' : '⏸️ Pausado'}
                    </div>
                  </div>

                  <div class="gm-quest">
                    <div class="gm-quest-title">
                      <span>🏰 Objetivo</span>
                      <span style="color: rgba(255,255,255,0.75)">Reerguer a Guilda</span>
                    </div>
                    <div class="gm-quest-desc">
                      Patrocine aventureiros, organize missões e controle o fluxo de ouro.
                    </div>
                  </div>
                </div>
              </section>

              <section class="gm-card">
                <h2>Quadro de Missões</h2>
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
                                ? `<button class="gm-quest-btn" data-quest-id="${quest.id}">Concluir</button>`
                                : `<div class="gm-small" style="margin-top:8px; color: rgba(0,255,136,0.9); font-weight: 900;">✓ Concluída</div>`
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
              <h2>Resumo</h2>
              <div class="gm-small">
                Dia ${state.day}, ${timeStr}. A guilda conta com ${state.npcs.length} NPCs trabalhando e vivendo na cidade.
                ${state.simRunning ? 'A simulação está rodando.' : 'Clique no botão ☀️ para iniciar a simulação.'}
              </div>
            </section>

            <section class="gm-card">
              <h2>Diário</h2>
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
