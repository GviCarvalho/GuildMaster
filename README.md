# GuildMaster

A browser-based singleplayer guild management game built with TypeScript and Vite.

## Features

- 🎮 Browser-based gameplay
- 🏰 Guild management mechanics
- ⚔️ Quest system
- 📈 Player progression
- 💰 Resource management

## Tech Stack

- **TypeScript** - Type-safe game logic
- **Vite** - Fast development and optimized builds
- **ESLint** - Code linting
- **Prettier** - Code formatting

## Project Structure

```
GuildMaster/
├── src/
│   ├── engine/          # Game engine and core logic
│   │   ├── GameEngine.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   ├── world/       # World management (Phase 1 & 2)
│   │   │   ├── map.ts        # Grid-based world map
│   │   │   ├── indices.ts    # Spatial & inventory indices
│   │   │   ├── inventory.ts  # Inventory mutation helpers
│   │   │   └── validation.ts # Debug validation
│   │   └── systems/     # Game systems
│   │       └── pathfinding.ts
│   ├── ui/              # User interface rendering
│   │   ├── GameUI.ts
│   │   └── index.ts
│   └── main.ts          # Application entry point
├── index.html           # HTML entry point
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
├── .eslintrc.json       # ESLint configuration
└── .prettierrc.json     # Prettier configuration
```

## Game Architecture

### Phase 2: World Indices

The game uses optimized indices for fast queries:

- **Spatial Index**: Fast neighbor/witness queries using cell-based spatial hashing
- **Inventory Index**: Quickly find NPCs selling specific items
- **POI Index**: Track entities at points of interest (taverns, markets, etc.)

All indices are automatically maintained and can be validated in development mode.

## Getting Started

### Prerequisites

- Node.js (version 18 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/GviCarvalho/GuildMaster.git
   cd GuildMaster
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the development server with hot module replacement:

```bash
npm run dev
```

This will start a local development server at `http://localhost:3000` and open it in your default browser.

### Building for Production

Create an optimized production build:

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Preview Production Build

Preview the production build locally:

```bash
npm run preview
```

### Type Checking

Run TypeScript type checking without emitting files:

```bash
npm run typecheck
```

### Linting

Run ESLint to check for code issues:

```bash
npm run lint
```

### Formatting

Format code with Prettier:

```bash
npm run format
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Run TypeScript type checker |
| `npm run lint` | Lint code with ESLint |
| `npm run format` | Format code with Prettier |

## How to Play

1. Start the game using `npm run dev`
2. View your player stats (gold, level, experience)
3. Complete quests to earn rewards
4. Level up and expand your guild

## Development Guidelines

- All source code is in the `src/` directory
- Engine logic is separated from UI rendering
- TypeScript is used for type safety
- Follow existing code style (enforced by ESLint and Prettier)

## License

MIT