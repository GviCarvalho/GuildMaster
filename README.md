# SALLAND OS

Projeto reorganizado em HTML/CSS/JS puro com estrutura modular para separar configuração, entidades, sistemas e laço principal. O canvas renderiza NPCs que coletam recursos, refinam, negociam e reagem a eventos, enquanto a barra lateral exibe estatísticas e scanner contextual.

## Como executar
1. Abra `index.html` diretamente no navegador, ou sirva a pasta raiz com um servidor estático (ex.: `python -m http.server`).
2. Passe o mouse sobre um NPC para ver detalhes; use os botões da barra lateral para alternar velocidade ou reiniciar a simulação.

## Estrutura
- `index.html` – ponto de entrada limpo que referencia os assets.
- `css/style.css` – estilos extraídos da UI e canvas.
- `js/config.js` – tabelas globais de jobs, traits e substâncias.
- `js/core/brain.js` – cérebro Q-learning usado pela IA.
- `js/systems/` – regras de fisiologia, personalidade e decisão.
- `js/entities/` – entidades base, recursos/depósitos e NPC completo.
- `js/main.js` – loop principal, renderização, UI e eventos.
