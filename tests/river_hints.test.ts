// E7 guard for the slice's playtest legibility helpers (src/river_hints.ts):
// pure presentation predicates that read the river's state. No DOM, no Three.
import { describe, expect, it } from 'vitest';
import { isCrossingEffect, offerHintVisible, tokenStonesVisible } from '../src/river_hints';
import { RIVER_OFFERING_RADIUS, RIVER_OFFERING_STONE } from '../src/sim/encounters/river_spirit';

describe('river hints: offering interaction hint', () => {
  const { x, z } = RIVER_OFFERING_STONE;
  it('hides without the token, even at the stone', () => {
    expect(offerHintVisible(false, x, z)).toBe(false);
  });
  it('hides with the token when away from the stone', () => {
    expect(offerHintVisible(true, x + RIVER_OFFERING_RADIUS + 3, z)).toBe(false);
  });
  it('shows only with the token AND within the offering radius', () => {
    expect(offerHintVisible(true, x, z)).toBe(true);
    expect(offerHintVisible(true, x + RIVER_OFFERING_RADIUS - 0.5, z)).toBe(true);
  });
});

describe('river hints: token stones visibility', () => {
  it('reflects hasToken: visible until gathered', () => {
    expect(tokenStonesVisible(false)).toBe(true);
    expect(tokenStonesVisible(true)).toBe(false);
  });
});

describe('river hints: crossing conclusion trigger', () => {
  it('is true for every valid far-shore crossing, false otherwise', () => {
    expect(isCrossingEffect('crossedFord')).toBe(true);
    expect(isCrossingEffect('crossedOpen')).toBe(true);
    expect(isCrossingEffect('reconciled')).toBe(true);
    for (const e of [
      'none',
      'manifested',
      'tokenGathered',
      'resistStarted',
      'carrying',
      'released',
    ] as const) {
      expect(isCrossingEffect(e)).toBe(false);
    }
  });
});
