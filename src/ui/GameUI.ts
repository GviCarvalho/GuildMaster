/**
 * UI rendering and interaction module
 */
import type { GameState } from '../engine';

export class GameUI {
  private rootElement: HTMLElement;
  private questCompleteHandler?: (questId: string) => void;

  constructor(rootElement: HTMLElement) {
    this.rootElement = rootElement;

    this.rootElement.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLButtonElement && target.dataset.questId) {
        this.questCompleteHandler?.(target.dataset.questId);
      }
    });
  }

  render(state: GameState, onQuestComplete: (questId: string) => void): void {
    this.questCompleteHandler = onQuestComplete;

    this.rootElement.innerHTML = `
      <div class="gm-stage">
        <div class="gm-layout">
          <!-- Left action bar -->
          <aside class="gm-actions" aria-label="Ações">
            <button class="gm-action-btn" data-action="passar-dia" title="Passar o dia">🌞</button>
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
                <div class="gm-hud-value">${state.day ?? state.player.level /* fallback */}</div>
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
                  A “sala” aqui é só um painel por enquanto — mais tarde dá pra colocar NPCs andando (canvas) por trás.
                </div>
                <div style="height: 10px"></div>
                <div class="gm-list">
                  <div class="gm-quest">
                    <div class="gm-quest-title">
                      <span>📌 Status</span>
                      <span>Nível ${state.player.level}</span>
                    </div>
                    <div class="gm-quest-desc">
                      Experiência: ${state.player.experience} XP
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
                Placeholder rápido pra ficar no clima “HUD + painéis”.<br/>
                Próximo: transformar isso num relatório do dia (rumores, incidentes, economia).
              </div>
            </section>

            <section class="gm-card">
              <h2>Diário</h2>
              <div class="gm-scroll gm-small" id="gm-log">
                <div>• Bem-vindo ao ProjectGM.</div>
                <div>• (Em breve) logs reais do motor vão aparecer aqui.</div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    `;

    // (Opcional) depois a gente liga esses botões em ações reais do motor.
  }
}
