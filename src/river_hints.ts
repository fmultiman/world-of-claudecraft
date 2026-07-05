// Presentation-only legibility helpers for the "O Rio" slice's first human
// playtest (E7). DOM-free and deterministic so they unit-test without a browser;
// the slice bootstrap (src/river_main.ts) does the actual DOM + Three work and
// only reflects these. The river's truth stays in the sim-pure river_spirit.ts
// module (relation, hasToken, crossings); these helpers just read it. The hints
// reduce ambiguity, they do not explain the solution.
import {
  RIVER_OFFERING_RADIUS,
  RIVER_OFFERING_STONE,
  type RiverSpiritEffect,
} from './sim/encounters/river_spirit';

// One-time spatial-intent line at boot (no system explanation, no mechanic
// names) and the one-time closing beat when the far bank is reached.
export const RIVER_INITIAL_HINT = 'Encontre um caminho para a outra margem.';
export const RIVER_CONCLUSION_LINE = 'A outra margem o recebe.';

// The contextual interaction cue. F is the stable interact keybind (KeyF).
export const RIVER_OFFER_HINT_TEXT = 'Interagir (F)';

// The offering hint shows only when the player carries the token AND stands
// within the offering radius of the shore stone. It hides on leaving, and after
// an accepted offer consumes the token.
export function offerHintVisible(hasToken: boolean, px: number, pz: number): boolean {
  if (!hasToken) return false;
  return (
    Math.hypot(px - RIVER_OFFERING_STONE.x, pz - RIVER_OFFERING_STONE.z) <= RIVER_OFFERING_RADIUS
  );
}

// The river-stone cue at the token spot is visible until the token is gathered.
export function tokenStonesVisible(hasToken: boolean): boolean {
  return !hasToken;
}

// A far-shore crossing by any valid path (the ford, the opened channel, or the
// reconciled channel): the trigger for the one-time closing beat.
export function isCrossingEffect(effect: RiverSpiritEffect): boolean {
  return effect === 'crossedFord' || effect === 'crossedOpen' || effect === 'reconciled';
}
