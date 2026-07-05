// E8 guard for the localized river presence (src/river_presence_visual.ts). The
// presence is PRESENTATION ONLY: these tests cover the pure state -> visual-mode
// mapping and the per-mode parameter distinctions, plus a scripted crossing that
// proves the mode tracks the river's relation WITHOUT changing any E6 behavior
// (the presentation is derived, never a driver). We deliberately do NOT test the
// THREE meshes deeply; the visual layer is experimental and reflects this truth.
import { describe, expect, it } from 'vitest';
import {
  presenceVisibleForMode,
  RIVER_PRESENCE_CENTER,
  RIVER_PRESENCE_PARAMS,
  type RiverPresenceMode,
  riverPresenceMode,
} from '../src/river_presence_visual';
import {
  RIVER_INITIAL_WORLD_CONTENT,
  RIVER_WORLD_SEED,
} from '../src/sim/content/river/initial_world';
import {
  createRiverSpiritState,
  isRiverCurrentActive,
  RIVER_CURRENT_TICKS,
  RIVER_FAR_SHORE_X,
  RIVER_SPIRIT_ANCHOR,
  type RiverRelation,
  type RiverSpiritState,
  updateRiverSpirit,
} from '../src/sim/encounters/river_spirit';
import { Sim } from '../src/sim/sim';
import { emptyMoveInput } from '../src/sim/types';
import { groundHeight, terrainHeight, WATER_LEVEL } from '../src/sim/world';

function makeRiverSim(): Sim {
  return new Sim({
    seed: RIVER_WORLD_SEED,
    playerClass: 'warrior',
    playerName: 'Neofito',
    world: RIVER_INITIAL_WORLD_CONTENT,
  });
}

function teleport(sim: Sim, x: number, z: number): void {
  sim.player.pos.x = x;
  sim.player.pos.z = z;
  sim.player.pos.y = terrainHeight(x, z, RIVER_WORLD_SEED);
  sim.player.prevPos = { ...sim.player.pos };
  sim.rebucket(sim.player);
}

// One bootstrap-shaped step, exactly as river_main.ts drives it: update the
// presence, gate input when the current owns the body, then tick.
function step(state: RiverSpiritState, sim: Sim): RiverPresenceMode {
  const effect = updateRiverSpirit(state, sim);
  if (isRiverCurrentActive(state) || effect === 'released') {
    Object.assign(sim.moveInput, emptyMoveInput());
  }
  sim.tick();
  return riverPresenceMode(state.relation, state.hasManifested, isRiverCurrentActive(state));
}

describe('river presence: state -> visual mode mapping', () => {
  it('is dormant until the river has manifested, for every relation', () => {
    const relations: RiverRelation[] = [
      'unknown',
      'observed',
      'authorized',
      'offended',
      'reconciled',
    ];
    for (const rel of relations) {
      expect(riverPresenceMode(rel, false, false)).toBe('dormant');
    }
  });

  it('the manifestation wakes the presence into the observed face', () => {
    expect(riverPresenceMode('observed', true, false)).toBe('observed');
  });

  it('an active current (resistance in motion) always reads as offended', () => {
    // Even if the stored relation were still observed for a tick, the current is
    // the offended face.
    expect(riverPresenceMode('observed', true, true)).toBe('offended');
    expect(riverPresenceMode('offended', true, true)).toBe('offended');
  });

  it('maps each settled relation to its own face', () => {
    expect(riverPresenceMode('offended', true, false)).toBe('offended');
    expect(riverPresenceMode('authorized', true, false)).toBe('authorized');
    expect(riverPresenceMode('reconciled', true, false)).toBe('reconciled');
  });
});

describe('river presence: per-mode parameter distinctions', () => {
  it('dormant paints nothing (the disable seam)', () => {
    expect(RIVER_PRESENCE_PARAMS.dormant.opacity).toBe(0);
    expect(presenceVisibleForMode('dormant')).toBe(false);
  });

  it('every awake mode is visible', () => {
    for (const mode of ['observed', 'offended', 'authorized', 'reconciled'] as const) {
      expect(presenceVisibleForMode(mode)).toBe(true);
    }
  });

  it('resistance (offended) is more turbulent and agitated than observed', () => {
    expect(RIVER_PRESENCE_PARAMS.offended.turbulence).toBeGreaterThan(
      RIVER_PRESENCE_PARAMS.observed.turbulence,
    );
    expect(RIVER_PRESENCE_PARAMS.offended.amplitude).toBeGreaterThan(
      RIVER_PRESENCE_PARAMS.observed.amplitude,
    );
    expect(RIVER_PRESENCE_PARAMS.offended.pulseSpeed).toBeGreaterThan(
      RIVER_PRESENCE_PARAMS.observed.pulseSpeed,
    );
  });

  it('authorized opens wider and calmer than offended closes in', () => {
    expect(RIVER_PRESENCE_PARAMS.authorized.reach).toBeGreaterThan(
      RIVER_PRESENCE_PARAMS.offended.reach,
    );
    expect(RIVER_PRESENCE_PARAMS.authorized.turbulence).toBeLessThan(
      RIVER_PRESENCE_PARAMS.offended.turbulence,
    );
  });

  it('authorized and reconciled are distinct: reconciled keeps a trace of tension', () => {
    // reconciled is a contained calm, but cooler and slightly more restless than
    // the fully open authorized water (the water yields but does not forget).
    expect(RIVER_PRESENCE_PARAMS.reconciled.turbulence).toBeGreaterThan(
      RIVER_PRESENCE_PARAMS.authorized.turbulence,
    );
    expect(RIVER_PRESENCE_PARAMS.reconciled.reach).toBeLessThan(
      RIVER_PRESENCE_PARAMS.authorized.reach,
    );
    expect(RIVER_PRESENCE_PARAMS.reconciled.opacity).not.toBe(
      RIVER_PRESENCE_PARAMS.authorized.opacity,
    );
  });
});

describe('river presence: center invariant', () => {
  it('sits over water immediately lakeward of the anchor (seed 20061)', () => {
    const h = groundHeight(RIVER_PRESENCE_CENTER.x, RIVER_PRESENCE_CENTER.z, RIVER_WORLD_SEED);
    expect(h).toBeLessThan(WATER_LEVEL);
    // Within the manifestation radius so it is in view when the river notices.
    const d = Math.hypot(
      RIVER_PRESENCE_CENTER.x - RIVER_SPIRIT_ANCHOR.x,
      RIVER_PRESENCE_CENTER.z - RIVER_SPIRIT_ANCHOR.z,
    );
    expect(d).toBeLessThan(12);
  });
});

describe('river presence: tracks the offended -> reconciled path without changing E6', () => {
  it('mode follows the relation across manifest, force, sweep, and ford', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();

    // 1) Manifest at the anchor: unknown -> observed, presence wakes to observed.
    teleport(sim, RIVER_SPIRIT_ANCHOR.x, RIVER_SPIRIT_ANCHOR.z);
    expect(step(state, sim)).toBe('observed');
    expect(state.relation).toBe('observed');
    expect(state.hasManifested).toBe(true);

    // 2) Force the deep channel: observed -> offended, the current fires, and the
    //    presence turns turbulent (offended).
    teleport(sim, -76, 78); // validated deep point toward the lake
    expect(step(state, sim)).toBe('offended');
    expect(state.relation).toBe('offended');
    expect(isRiverCurrentActive(state)).toBe(true);

    // 3) The current sweeps the body back; the presence stays offended throughout
    //    and after release (relation is still offended, no permission granted).
    let released = false;
    for (let i = 0; i < RIVER_CURRENT_TICKS + 20; i++) {
      const mode = step(state, sim);
      expect(mode).toBe('offended');
      if (!isRiverCurrentActive(state)) {
        released = true;
        break;
      }
    }
    expect(released).toBe(true);
    expect(state.relation).toBe('offended');

    // 4) Humbly cross the shallow ford: offended -> reconciled ONLY on reaching
    //    the far bank, and the presence settles into the contained reconciled face.
    const fordLine: [number, number][] = [
      [-95, 62],
      [-99, 62],
      [-103, 62],
      [RIVER_FAR_SHORE_X, 62],
    ];
    let finalMode: RiverPresenceMode = 'offended';
    for (const [x, z] of fordLine) {
      teleport(sim, x, z);
      finalMode = step(state, sim);
    }
    expect(state.relation).toBe('reconciled');
    expect(finalMode).toBe('reconciled');
  });

  it('reaching the far bank grants no deep-channel permission beyond the relation', () => {
    // Guard against an "unlock by arrival" regression: the presence mode and the
    // reconciliation come from the relation transition at the ford, not from the
    // far-shore edge itself. A far-shore arrival while still observed stays the
    // observed face (a ford crossing, relation unchanged).
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    teleport(sim, RIVER_SPIRIT_ANCHOR.x, RIVER_SPIRIT_ANCHOR.z);
    step(state, sim); // observed
    teleport(sim, RIVER_FAR_SHORE_X, 62);
    const mode = step(state, sim);
    expect(state.relation).toBe('observed');
    expect(mode).toBe('observed');
  });
});
