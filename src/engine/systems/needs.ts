/**
 * Phase 3: NPC needs system
 * 
 * This module manages NPC needs (hunger, social, fun) that drive behavior.
 * Needs are clamped between 0 and 100.
 */

import type { NPC } from '../types';
import type { MacroSnapshot } from '../dna';

export interface Needs {
  hunger: number;
  social: number;
  fun: number;
}

/**
 * Initialize needs for an NPC (default to 50 for all needs)
 */
export function initializeNeeds(npc: NPC): void {
  if (!npc.needs) {
    npc.needs = {
      hunger: 50,
      social: 50,
      fun: 50,
    };
  }
}

/**
 * Ensure NPC has needs initialized
 */
export function ensureNeeds(npc: NPC): Needs {
  if (!npc.needs) {
    initializeNeeds(npc);
  }
  return npc.needs!;
}

/**
 * Clamp a need value between 0 and 100
 */
function clampNeed(value: number): number {
  return Math.max(0, Math.min(100, value));
}

/**
 * Modify a need value by a delta and clamp
 */
export function modifyNeed(npc: NPC, needType: keyof Needs, delta: number): void {
  const needs = ensureNeeds(npc);
  needs[needType] = clampNeed(needs[needType] + delta);
}

/**
 * Set a need value directly (clamped)
 */
export function setNeed(npc: NPC, needType: keyof Needs, value: number): void {
  const needs = ensureNeeds(npc);
  needs[needType] = clampNeed(value);
}

/**
 * Get a need value
 */
export function getNeed(npc: NPC, needType: keyof Needs): number {
  const needs = ensureNeeds(npc);
  return needs[needType];
}

/**
 * Get the most urgent need for an NPC
 * Returns the need type with the lowest value
 */
export function getMostUrgentNeed(npc: NPC): keyof Needs {
  const needs = ensureNeeds(npc);
  
  let minNeed: keyof Needs = 'hunger';
  let minValue = needs.hunger;
  
  if (needs.social < minValue) {
    minNeed = 'social';
    minValue = needs.social;
  }
  
  if (needs.fun < minValue) {
    minNeed = 'fun';
    minValue = needs.fun;
  }
  
  return minNeed;
}

/**
 * Check if any need is critical (below threshold)
 */
export function hasCriticalNeed(npc: NPC, threshold: number = 20): boolean {
  const needs = ensureNeeds(npc);
  return needs.hunger < threshold || needs.social < threshold || needs.fun < threshold;
}

/**
 * Apply need decay over time (passive degradation)
 * Called periodically to simulate needs deteriorating
 */
export function applyNeedDecay(npc: NPC, hungerDecay: number, socialDecay: number, funDecay: number): void {
  modifyNeed(npc, 'hunger', -hungerDecay);
  modifyNeed(npc, 'social', -socialDecay);
  modifyNeed(npc, 'fun', -funDecay);
}

/**
 * Satisfy a need by performing an action
 * This is called when an NPC performs an action that fulfills a need
 */
export function satisfyNeed(npc: NPC, needType: keyof Needs, amount: number): void {
  modifyNeed(npc, needType, amount);
}

/**
 * Synchronize need meters from a chemistry-derived macro snapshot (0..1 signals).
 */
export function syncNeedsFromMacro(npc: NPC, macro: MacroSnapshot): void {
  const needs = ensureNeeds(npc);
  const hungerSatisfaction = 1 - macro.hungerSignal; // hungerSignal high => low satisfaction
  const socialSatisfaction = clampNeed((0.5 * (1 - macro.stress) + 0.5 * macro.mood) * 100);
  needs.hunger = clampNeed(hungerSatisfaction * 100);
  needs.fun = clampNeed(macro.mood * 100);
  needs.social = socialSatisfaction;
}

/**
 * Get need status as a string for debugging
 */
export function getNeedStatus(npc: NPC): string {
  const needs = ensureNeeds(npc);
  return `Hunger: ${needs.hunger.toFixed(0)}, Social: ${needs.social.toFixed(0)}, Fun: ${needs.fun.toFixed(0)}`;
}
