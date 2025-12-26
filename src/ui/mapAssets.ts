import { TileType } from '../engine/world/map';

type TileGlyph = {
  glyph: string;
  name: string;
};

export const asciiTilePalette: Record<TileType, TileGlyph> = {
  [TileType.Road]: { glyph: '╫', name: 'Cobbled road' },
  [TileType.Building]: { glyph: '▓', name: 'Dense buildings' },
  [TileType.Water]: { glyph: '≈', name: 'Waterfront' },
};

export const mapFrame = {
  topLeft: '╔',
  topRight: '╗',
  bottomLeft: '╚',
  bottomRight: '╝',
  horizontal: '═',
  vertical: '║',
};

export const mapLegendGlyphs = [
  { label: 'Road', glyph: asciiTilePalette[TileType.Road].glyph },
  { label: 'Building', glyph: asciiTilePalette[TileType.Building].glyph },
  { label: 'Water', glyph: asciiTilePalette[TileType.Water].glyph },
  { label: 'POI', glyph: '◎' },
  { label: 'NPC', glyph: '@' },
  { label: 'En route', glyph: '>' },
  { label: 'Crowd', glyph: '*' },
];
