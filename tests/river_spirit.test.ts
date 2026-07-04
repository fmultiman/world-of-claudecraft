// E4 guard for the river presence (src/sim/encounters/river_spirit.ts): the
// manifestation fires once per session on first entry into the anchor radius,
// rides the supported { type: 'log' } SimEvent in the same tick's drain, stays
// deterministic for the documented seed, and keeps instances independent. The
// module is host-driven (never wired into Sim.tick), so these tests call
// updateRiverSpirit exactly the way the slice bootstrap does: before each tick.
import { describe, expect, it } from 'vitest';
import {
  RIVER_INITIAL_WORLD_CONTENT,
  RIVER_PLAYER_START,
  RIVER_WORLD_SEED,
} from '../src/sim/content/river/initial_world';
import {
  createRiverSpiritState,
  RIVER_MANIFESTATION_LINE,
  RIVER_SPIRIT_ANCHOR,
  RIVER_SPIRIT_RADIUS,
  type RiverSpiritState,
  updateRiverSpirit,
} from '../src/sim/encounters/river_spirit';
import { Sim } from '../src/sim/sim';
import type { SimEvent } from '../src/sim/types';
import { terrainHeight, WATER_LEVEL, zoneBiomeAt } from '../src/sim/world';

function makeRiverSim(): Sim {
  return new Sim({
    seed: RIVER_WORLD_SEED,
    playerClass: 'warrior',
    playerName: 'Neofito',
    world: RIVER_INITIAL_WORLD_CONTENT,
  });
}

// The tests/CLAUDE.md teleport idiom: place, ground, and rebucket the player.
function teleport(sim: Sim, x: number, z: number): void {
  sim.player.pos.x = x;
  sim.player.pos.z = z;
  sim.player.pos.y = terrainHeight(x, z, RIVER_WORLD_SEED);
  sim.player.prevPos = { ...sim.player.pos };
  sim.rebucket(sim.player);
}

// One bootstrap-shaped step: update the presence, then tick, returning the
// tick's drained events plus the manifestation edge.
function step(state: RiverSpiritState, sim: Sim): { edge: boolean; events: SimEvent[] } {
  const edge = updateRiverSpirit(state, sim);
  return { edge, events: sim.tick() };
}

const isManifestationLog = (e: SimEvent): boolean =>
  e.type === 'log' && e.text === RIVER_MANIFESTATION_LINE;

describe('river spirit: anchor geometry', () => {
  it('sits on dry vale shore ground, outside the spawn radius', () => {
    const { x, z } = RIVER_SPIRIT_ANCHOR;
    expect(zoneBiomeAt(z)).toBe('vale');
    const h = terrainHeight(x, z, RIVER_WORLD_SEED);
    expect(h).toBeGreaterThan(WATER_LEVEL); // dry land, not underwater
    // The spawn must NOT be inside the manifestation radius: only walking
    // toward the water triggers the presence.
    const dSpawn = Math.hypot(RIVER_PLAYER_START.x - x, RIVER_PLAYER_START.z - z);
    expect(dSpawn).toBeGreaterThan(RIVER_SPIRIT_RADIUS);
  });
});

describe('river spirit: proximity lifecycle', () => {
  it('does nothing outside the radius, fires exactly once inside, never repeats', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    // At spawn (outside the radius): nothing.
    for (let i = 0; i < 10; i++) {
      const { edge, events } = step(state, sim);
      expect(edge).toBe(false);
      expect(events.some(isManifestationLog)).toBe(false);
    }
    expect(state.hasManifested).toBe(false);
    // Enter the radius: the edge fires and the log event drains in the same tick.
    teleport(sim, RIVER_SPIRIT_ANCHOR.x + 2, RIVER_SPIRIT_ANCHOR.z);
    const entered = step(state, sim);
    expect(entered.edge).toBe(true);
    expect(entered.events.some(isManifestationLog)).toBe(true);
    expect(state.hasManifested).toBe(true);
    expect(state.manifestedAtTick).not.toBeNull();
    // Staying inside does not repeat.
    for (let i = 0; i < 10; i++) {
      const { edge, events } = step(state, sim);
      expect(edge).toBe(false);
      expect(events.some(isManifestationLog)).toBe(false);
    }
    // Leaving and returning does not repeat in the same session.
    teleport(sim, RIVER_PLAYER_START.x, RIVER_PLAYER_START.z);
    step(state, sim);
    teleport(sim, RIVER_SPIRIT_ANCHOR.x, RIVER_SPIRIT_ANCHOR.z + 1);
    const returned = step(state, sim);
    expect(returned.edge).toBe(false);
    expect(returned.events.some(isManifestationLog)).toBe(false);
  });

  it('keeps two Sim instances independent', () => {
    const simA = makeRiverSim();
    const simB = makeRiverSim();
    const stateA = createRiverSpiritState();
    const stateB = createRiverSpiritState();
    teleport(simA, RIVER_SPIRIT_ANCHOR.x, RIVER_SPIRIT_ANCHOR.z);
    expect(step(stateA, simA).edge).toBe(true);
    expect(stateA.hasManifested).toBe(true);
    // B never approached: untouched by A's manifestation.
    expect(step(stateB, simB).edge).toBe(false);
    expect(stateB.hasManifested).toBe(false);
  });
});

describe('river spirit: determinism', () => {
  it('a scripted walk manifests on the same tick with an identical event sequence', () => {
    const run = (): { tick: number | null; logTicks: number[] } => {
      const sim = makeRiverSim();
      const state = createRiverSpiritState();
      // The bootstrap's own facing: walk straight toward Mirror Lake.
      const facing = Math.atan2(-92 - sim.player.pos.x, 88 - sim.player.pos.z);
      sim.player.facing = facing;
      sim.player.prevFacing = facing;
      sim.moveInput.forward = true;
      const logTicks: number[] = [];
      for (let i = 0; i < 20 * 30; i++) {
        const { events } = step(state, sim);
        if (events.some(isManifestationLog)) logTicks.push(sim.tickCount);
        if (state.hasManifested && sim.tickCount > (state.manifestedAtTick ?? 0) + 40) break;
      }
      return { tick: state.manifestedAtTick, logTicks };
    };
    const a = run();
    const b = run();
    expect(a.tick).not.toBeNull();
    expect(a).toEqual(b);
    expect(a.logTicks).toHaveLength(1);
  });
});

describe('river spirit: world stays MMO-empty', () => {
  it('adds no entity: the anchor is territorial, not populated', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    teleport(sim, RIVER_SPIRIT_ANCHOR.x, RIVER_SPIRIT_ANCHOR.z);
    step(state, sim);
    expect([...sim.entities.values()].map((e) => e.kind)).toEqual(['player']);
  });
});
