/**
 * World map with grid-based tile system
 */

export enum TileType {
  Road = 'road',
  Building = 'building',
  Water = 'water',
}

export interface Tile {
  type: TileType;
  walkable: boolean;
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface POI {
  id: string;
  name: string;
  pos: Vec2;
  footprint?: Vec2; // Optional size (width, height)
}

export class WorldMap {
  readonly width: number;
  readonly height: number;
  private tiles: Tile[][];
  private pois: POI[];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.tiles = [];
    this.pois = [];
    this.initializeGrid();
  }

  private initializeGrid(): void {
    // Initialize all tiles as roads (walkable)
    for (let y = 0; y < this.height; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < this.width; x++) {
        row.push({
          type: TileType.Road,
          walkable: true,
        });
      }
      this.tiles.push(row);
    }
  }

  /**
   * Generate a simple procedural city layout
   */
  generateCity(): void {
    // Create a simple city with roads and buildings
    // Main roads (horizontal and vertical)
    const mainRoadInterval = 8;
    
    // Place buildings in a grid pattern with roads between
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // Main roads
        if (x % mainRoadInterval === 0 || y % mainRoadInterval === 0) {
          this.setTile(x, y, TileType.Road, true);
        }
        // Create some buildings in blocks
        else if (
          (x % mainRoadInterval > 1 && x % mainRoadInterval < mainRoadInterval - 1) &&
          (y % mainRoadInterval > 1 && y % mainRoadInterval < mainRoadInterval - 1)
        ) {
          // 70% chance of building in the interior - use deterministic pattern
          const hash = (x * 73 + y * 31) % 10;
          if (hash < 7) {
            this.setTile(x, y, TileType.Building, false);
          }
        }
      }
    }

    // Add water/blocked areas on edges (deterministic positions)
    const waterPositions = [
      [2, 3], [5, 1], [1, 6], [4, 2], [6, 5],
      [3, 4], [7, 0], [0, 7], [2, 1], [5, 6]
    ];
    
    for (const [dx, dy] of waterPositions) {
      this.setTile(dx, dy, TileType.Water, false);
      this.setTile(this.width - 1 - dx, this.height - 1 - dy, TileType.Water, false);
    }

    // Initialize POIs
    this.initializePOIs();
  }

  private initializePOIs(): void {
    // Place POIs at strategic locations on roads
    this.pois = [
      {
        id: 'guild-hall',
        name: 'Guild Hall',
        pos: { x: 32, y: 32 }, // Center of map
        footprint: { x: 2, y: 2 },
      },
      {
        id: 'tavern',
        name: 'Tavern',
        pos: { x: 16, y: 16 },
        footprint: { x: 2, y: 2 },
      },
      {
        id: 'market',
        name: 'Market',
        pos: { x: 48, y: 16 },
        footprint: { x: 3, y: 3 },
      },
      {
        id: 'mine',
        name: 'Mine',
        pos: { x: 8, y: 48 },
        footprint: { x: 2, y: 2 },
      },
      {
        id: 'forest',
        name: 'Forest',
        pos: { x: 56, y: 48 },
        footprint: { x: 3, y: 3 },
      },
    ];

    // Ensure POI locations are walkable (including footprint area)
    this.pois.forEach((poi) => {
      const width = poi.footprint?.x || 1;
      const height = poi.footprint?.y || 1;
      
      for (let dy = 0; dy < height; dy++) {
        for (let dx = 0; dx < width; dx++) {
          this.setTile(poi.pos.x + dx, poi.pos.y + dy, TileType.Road, true);
        }
      }
    });
  }

  getTile(x: number, y: number): Tile | null {
    if (!this.isInBounds(x, y)) {
      return null;
    }
    return this.tiles[y][x];
  }

  setTile(x: number, y: number, type: TileType, walkable: boolean): void {
    if (!this.isInBounds(x, y)) {
      return;
    }
    this.tiles[y][x] = { type, walkable };
  }

  isWalkable(x: number, y: number): boolean {
    const tile = this.getTile(x, y);
    return tile !== null && tile.walkable;
  }

  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getPOIs(): POI[] {
    return [...this.pois];
  }

  getPOI(id: string): POI | undefined {
    return this.pois.find((poi) => poi.id === id);
  }
}
