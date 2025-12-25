import type { Mix } from '../dna';
import { mixMerge } from '../dna';
import type { ItemId } from '../types';

export interface ItemDefinition {
  id: ItemId;
  name: string;
  mix: Mix;
}

/**
 * Registry that maps ItemId -> Mix. Items are defined by their chemical DNA, not by a static template.
 */
export class ItemRegistry {
  private items: Map<ItemId, ItemDefinition> = new Map();
  private counter = 0;

  constructor(seedItems?: ItemDefinition[]) {
    seedItems?.forEach((item) => this.items.set(item.id, { ...item, mix: { ...item.mix } }));
  }

  register(id: ItemId, name: string, mix: Mix): ItemId {
    this.items.set(id, { id, name, mix: { ...mix } });
    return id;
  }

  spawnFromMix(name: string, mix: Mix): ItemId {
    this.counter += 1;
    const id = `${name.toLowerCase().replace(/\s+/g, '-')}-${this.counter}` as ItemId;
    return this.register(id, name, mix);
  }

  getItem(id: ItemId): ItemDefinition | undefined {
    const item = this.items.get(id);
    return item ? { ...item, mix: { ...item.mix } } : undefined;
  }

  getMix(id: ItemId): Mix | undefined {
    const item = this.items.get(id);
    return item ? { ...item.mix } : undefined;
  }

  mergeItemMix(id: ItemId, delta: Mix): void {
    const item = this.items.get(id);
    if (!item) return;
    item.mix = mixMerge(item.mix, delta);
  }

  list(): ItemDefinition[] {
    return Array.from(this.items.values()).map((item) => ({ ...item, mix: { ...item.mix } }));
  }
}

export function createSeedItemRegistry(): ItemRegistry {
  const seedItems: ItemDefinition[] = [
    { id: 'berry-red', name: 'Moranguito', mix: { GLU: 0.6, FRUCT: 0.4, DOCE: 0.2, H2O: 0.5 } },
    { id: 'ore-iron', name: 'Minério de Ferro', mix: { ORE_FE: 1, MINERAL_DUST: 0.1 } },
    { id: 'ore-copper', name: 'Minério de Cobre', mix: { ORE_CU: 1, MINERAL_DUST: 0.1 } },
    { id: 'water-flask', name: 'Cantimplora', mix: { H2O: 1 } },
    { id: 'raw-wood', name: 'Madeira', mix: { FIBER: 0.6, RESIN: 0.3, H2O: 0.2 } },
    { id: 'raw-stone', name: 'Pedra', mix: { SILICA: 0.5, MINERAL_DUST: 0.4 } },
    { id: 'raw-coal', name: 'Carvão', mix: { CARBON: 0.5, ORE_COAL: 0.5, COAL: 0.3 } },
    { id: 'raw-salt', name: 'Sal', mix: { SALT: 0.8 } },
    { id: 'raw-water', name: 'Água', mix: { H2O: 1 } },
  ];

  return new ItemRegistry(seedItems);
}
