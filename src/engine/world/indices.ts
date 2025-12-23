/**
 * Phase 2: World indices for fast queries
 * 
 * This module provides spatial and inventory indices to avoid O(N) scans:
 * - entitiesByCell: spatial index for neighbor/witness queries
 * - sellersByItem: inventory-driven seller lookup
 * - entitiesByPoi: entities grouped by POI (optional, for future use)
 */

import type { EntityId, ItemId, PoiId, CellId } from '../types';
import type { Vec2 } from './map';

/**
 * WorldIndices manages all game indices for fast lookups
 * These indices are non-serializable and can be rebuilt from world state
 */
export class WorldIndices {
  private mapWidth: number;
  
  // Spatial index: entities by cell
  private entitiesByCell: Map<CellId, Set<EntityId>>;
  
  // Inventory index: sellers by item
  private sellersByItem: Map<ItemId, Set<EntityId>>;
  
  // POI index: entities by POI (optional for now)
  private entitiesByPoi: Map<PoiId, Set<EntityId>>;

  constructor(mapWidth: number) {
    this.mapWidth = mapWidth;
    this.entitiesByCell = new Map();
    this.sellersByItem = new Map();
    this.entitiesByPoi = new Map();
  }

  /**
   * Convert 2D coordinates to numeric cellId for spatial indexing
   */
  getCellId(x: number, y: number): CellId {
    return x + y * this.mapWidth;
  }

  /**
   * Convert cellId back to 2D coordinates
   */
  getCellPos(cellId: CellId): Vec2 {
    return {
      x: cellId % this.mapWidth,
      y: Math.floor(cellId / this.mapWidth),
    };
  }

  // ============================================================
  // Spatial Index Operations
  // ============================================================

  /**
   * Register entity at a specific cell
   */
  addEntityToCell(entityId: EntityId, pos: Vec2): void {
    const cellId = this.getCellId(pos.x, pos.y);
    let entities = this.entitiesByCell.get(cellId);
    
    if (!entities) {
      entities = new Set();
      this.entitiesByCell.set(cellId, entities);
    }
    
    entities.add(entityId);
  }

  /**
   * Remove entity from a specific cell
   */
  removeEntityFromCell(entityId: EntityId, pos: Vec2): void {
    const cellId = this.getCellId(pos.x, pos.y);
    const entities = this.entitiesByCell.get(cellId);
    
    if (entities) {
      entities.delete(entityId);
      
      // Clean up empty sets
      if (entities.size === 0) {
        this.entitiesByCell.delete(cellId);
      }
    }
  }

  /**
   * Move entity from one cell to another
   */
  moveEntity(entityId: EntityId, fromPos: Vec2, toPos: Vec2): void {
    // Only update if position actually changed
    if (fromPos.x === toPos.x && fromPos.y === toPos.y) {
      return;
    }
    
    this.removeEntityFromCell(entityId, fromPos);
    this.addEntityToCell(entityId, toPos);
  }

  /**
   * Get all entities in a specific cell
   */
  getEntitiesInCell(pos: Vec2): Set<EntityId> {
    const cellId = this.getCellId(pos.x, pos.y);
    return this.entitiesByCell.get(cellId) || new Set();
  }

  /**
   * Get all entities within a radius (Manhattan distance)
   * Useful for neighbor queries, witness detection, etc.
   */
  getEntitiesInRadius(center: Vec2, radius: number): Set<EntityId> {
    const result = new Set<EntityId>();
    
    // Scan cells in bounding box
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = center.x + dx;
        const y = center.y + dy;
        
        // Check Manhattan distance
        const distance = Math.abs(dx) + Math.abs(dy);
        if (distance <= radius) {
          const entities = this.getEntitiesInCell({ x, y });
          entities.forEach((entityId) => result.add(entityId));
        }
      }
    }
    
    return result;
  }

  // ============================================================
  // Inventory Index Operations
  // ============================================================

  /**
   * Register entity as seller of a specific item
   */
  addSeller(entityId: EntityId, itemId: ItemId): void {
    let sellers = this.sellersByItem.get(itemId);
    
    if (!sellers) {
      sellers = new Set();
      this.sellersByItem.set(itemId, sellers);
    }
    
    sellers.add(entityId);
  }

  /**
   * Unregister entity as seller of a specific item
   */
  removeSeller(entityId: EntityId, itemId: ItemId): void {
    const sellers = this.sellersByItem.get(itemId);
    
    if (sellers) {
      sellers.delete(entityId);
      
      // Clean up empty sets
      if (sellers.size === 0) {
        this.sellersByItem.delete(itemId);
      }
    }
  }

  /**
   * Get all sellers of a specific item
   */
  getSellersOfItem(itemId: ItemId): Set<EntityId> {
    return this.sellersByItem.get(itemId) || new Set();
  }

  /**
   * Update seller index when inventory changes
   * Should be called by inventory mutation helpers
   */
  updateSellerIndex(entityId: EntityId, itemId: ItemId, newQuantity: number, oldQuantity: number): void {
    // If item quantity went from 0 to positive, add as seller
    if (oldQuantity === 0 && newQuantity > 0) {
      this.addSeller(entityId, itemId);
    }
    // If item quantity went from positive to 0, remove as seller
    else if (oldQuantity > 0 && newQuantity === 0) {
      this.removeSeller(entityId, itemId);
    }
  }

  // ============================================================
  // POI Index Operations (Optional for Phase 2)
  // ============================================================

  /**
   * Register entity at a POI
   */
  addEntityToPOI(entityId: EntityId, poiId: PoiId): void {
    let entities = this.entitiesByPoi.get(poiId);
    
    if (!entities) {
      entities = new Set();
      this.entitiesByPoi.set(poiId, entities);
    }
    
    entities.add(entityId);
  }

  /**
   * Remove entity from a POI
   */
  removeEntityFromPOI(entityId: EntityId, poiId: PoiId): void {
    const entities = this.entitiesByPoi.get(poiId);
    
    if (entities) {
      entities.delete(entityId);
      
      // Clean up empty sets
      if (entities.size === 0) {
        this.entitiesByPoi.delete(poiId);
      }
    }
  }

  /**
   * Get all entities at a specific POI
   */
  getEntitiesAtPOI(poiId: PoiId): Set<EntityId> {
    return this.entitiesByPoi.get(poiId) || new Set();
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Clear all indices
   */
  clear(): void {
    this.entitiesByCell.clear();
    this.sellersByItem.clear();
    this.entitiesByPoi.clear();
  }

  /**
   * Get debug info about index sizes
   */
  getDebugInfo(): {
    cellCount: number;
    itemCount: number;
    poiCount: number;
    totalCellEntities: number;
    totalItemSellers: number;
    totalPoiEntities: number;
  } {
    let totalCellEntities = 0;
    this.entitiesByCell.forEach((entities) => {
      totalCellEntities += entities.size;
    });

    let totalItemSellers = 0;
    this.sellersByItem.forEach((sellers) => {
      totalItemSellers += sellers.size;
    });

    let totalPoiEntities = 0;
    this.entitiesByPoi.forEach((entities) => {
      totalPoiEntities += entities.size;
    });

    return {
      cellCount: this.entitiesByCell.size,
      itemCount: this.sellersByItem.size,
      poiCount: this.entitiesByPoi.size,
      totalCellEntities,
      totalItemSellers,
      totalPoiEntities,
    };
  }
}
