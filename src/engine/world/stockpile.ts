import type { ItemId, PoiId } from '../types';
import type { ItemDefinition, ItemRegistry } from './items';

interface RandomLike {
  choice<T>(array: T[]): T;
  next?(): number;
}

export type Stockpile = Record<ItemId, number>;
export type StockpilesByPoi = Record<PoiId, Stockpile>;

export function stockHas(stock: Stockpile, itemId: ItemId, qty: number): boolean {
  return (stock[itemId] ?? 0) >= qty;
}

export function stockAdd(stock: Stockpile, itemId: ItemId, qty: number): void {
  if (qty <= 0) return;
  stock[itemId] = (stock[itemId] ?? 0) + qty;
}

export function stockRemove(stock: Stockpile, itemId: ItemId, qty: number): boolean {
  if (!stockHas(stock, itemId, qty)) return false;
  const next = (stock[itemId] ?? 0) - qty;
  if (next <= 0) {
    delete stock[itemId];
  } else {
    stock[itemId] = next;
  }
  return true;
}

export function stockPickByTag(
  stock: Stockpile,
  itemRegistry: ItemRegistry,
  tag: string,
  random: RandomLike,
): ItemDefinition | null {
  const candidates = itemRegistry
    .list()
    .filter((item) => item.tags?.includes(tag) && stockHas(stock, item.id, 1));

  if (candidates.length === 0) return null;

  return random.choice(candidates);
}

export function getPoiStockpile(stockpilesByPoi: StockpilesByPoi, poiId: PoiId): Stockpile {
  if (!stockpilesByPoi[poiId]) {
    stockpilesByPoi[poiId] = {};
  }
  return stockpilesByPoi[poiId];
}
