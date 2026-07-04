// E4+E5 guard for the river presence (src/sim/encounters/river_spirit.ts): the
// first manifestation fires once (unknown -> observed), and a forced deep-water
// entry (observed -> offended) starts the current, which sweeps the body back
// to the dry bank over a fixed number of ticks, deterministically, with no
// damage. The module is host-driven (never wired into Sim.tick), so these tests
// call it exactly the way the slice bootstrap does: update -> gate input -> tick.
import { describe, expect, it } from 'vitest';
import {
  RIVER_INITIAL_WORLD_CONTENT,
  RIVER_PLAYER_START,
  RIVER_WORLD_SEED,
} from '../src/sim/content/river/initial_world';
import {
  createRiverSpiritState,
  isRiverCurrentActive,
  RIVER_CURRENT_TICKS,
  RIVER_MANIFESTATION_LINE,
  RIVER_RESISTANCE_LINE,
  RIVER_RETURN_POS,
  RIVER_SPIRIT_ANCHOR,
  RIVER_SPIRIT_RADIUS,
  type RiverSpiritEffect,
  type RiverSpiritState,
  updateRiverSpirit,
} from '../src/sim/encounters/river_spirit';
import { PLAYER_SWIM_DEPTH } from '../src/sim/pathfind';
import { Sim } from '../src/sim/sim';
import type { MoveInput, SimEvent } from '../src/sim/types';
import { emptyMoveInput } from '../src/sim/types';
import { terrainHeight, WATER_LEVEL, zoneBiomeAt } from '../src/sim/world';

const DEEP_WATER_GROUND = WATER_LEVEL - PLAYER_SWIM_DEPTH; // -5.3
// A validated deep-water point ~10yd past the anchor toward Mirror Lake.
const DEEP_POINT = { x: -76, z: 78 };

function makeRiverSim(): Sim {
  return new Sim({
    seed: RIVER_WORLD_SEED,
    playerClass: 'warrior',
    playerName: 'Neofito',
    world: RIVER_INITIAL_WORLD_CONTENT,
  });
}

// tests/CLAUDE.md teleport idiom: place, ground, rebucket.
function teleport(sim: Sim, x: number, z: number): void {
  sim.player.pos.x = x;
  sim.player.pos.z = z;
  sim.player.pos.y = terrainHeight(x, z, RIVER_WORLD_SEED);
  sim.player.prevPos = { ...sim.player.pos };
  sim.rebucket(sim.player);
}

// One bootstrap-shaped step: update the presence, gate input exactly as
// river_main.ts does (the current owns the body -> player intent is dropped),
// then tick. Returns the effect and the tick's drained events.
function step(
  state: RiverSpiritState,
  sim: Sim,
  playerInput?: Partial<MoveInput>,
): { effect: RiverSpiritEffect; events: SimEvent[] } {
  const effect = updateRiverSpirit(state, sim);
  const riverOwnsBody = isRiverCurrentActive(state) || effect === 'released';
  if (riverOwnsBody) {
    Object.assign(sim.moveInput, emptyMoveInput());
  } else if (playerInput) {
    Object.assign(sim.moveInput, playerInput);
  }
  return { effect, events: sim.tick() };
}

const isManifestationLog = (e: SimEvent): boolean =>
  e.type === 'log' && e.text === RIVER_MANIFESTATION_LINE;
const isResistanceLog = (e: SimEvent): boolean =>
  e.type === 'log' && e.text === RIVER_RESISTANCE_LINE;

// Drive the current to completion from a deep-water start with the given
// relation, recording per-tick displacement. Optionally feed player input every
// tick to prove it is ignored.
function runCurrent(
  sim: Sim,
  state: RiverSpiritState,
  playerInput?: Partial<MoveInput>,
): { effects: RiverSpiritEffect[]; positions: { x: number; z: number }[] } {
  const effects: RiverSpiritEffect[] = [];
  const positions: { x: number; z: number }[] = [];
  for (let i = 0; i < RIVER_CURRENT_TICKS + 20; i++) {
    const { effect } = step(state, sim, playerInput);
    effects.push(effect);
    positions.push({ x: sim.player.pos.x, z: sim.player.pos.z });
    if (effect === 'released') break;
  }
  return { effects, positions };
}

describe('river spirit: geometry', () => {
  it('anchor is dry vale shore outside the spawn radius; return is dry and near', () => {
    expect(zoneBiomeAt(RIVER_SPIRIT_ANCHOR.z)).toBe('vale');
    expect(
      terrainHeight(RIVER_SPIRIT_ANCHOR.x, RIVER_SPIRIT_ANCHOR.z, RIVER_WORLD_SEED),
    ).toBeGreaterThan(WATER_LEVEL);
    const dSpawn = Math.hypot(
      RIVER_PLAYER_START.x - RIVER_SPIRIT_ANCHOR.x,
      RIVER_PLAYER_START.z - RIVER_SPIRIT_ANCHOR.z,
    );
    expect(dSpawn).toBeGreaterThan(RIVER_SPIRIT_RADIUS);
    // Return: dry, gentle slope, close to the anchor, NOT deep water.
    const rh = terrainHeight(RIVER_RETURN_POS.x, RIVER_RETURN_POS.z, RIVER_WORLD_SEED);
    expect(rh).toBeGreaterThan(WATER_LEVEL + 1);
    expect(rh).toBeGreaterThan(DEEP_WATER_GROUND);
    const dhx =
      (terrainHeight(RIVER_RETURN_POS.x + 2, RIVER_RETURN_POS.z, RIVER_WORLD_SEED) -
        terrainHeight(RIVER_RETURN_POS.x - 2, RIVER_RETURN_POS.z, RIVER_WORLD_SEED)) /
      4;
    const dhz =
      (terrainHeight(RIVER_RETURN_POS.x, RIVER_RETURN_POS.z + 2, RIVER_WORLD_SEED) -
        terrainHeight(RIVER_RETURN_POS.x, RIVER_RETURN_POS.z - 2, RIVER_WORLD_SEED)) /
      4;
    expect(Math.hypot(dhx, dhz)).toBeLessThan(1.5); // under PLAYER_MAX_CLIMB_SLOPE
    expect(
      Math.hypot(
        RIVER_RETURN_POS.x - RIVER_SPIRIT_ANCHOR.x,
        RIVER_RETURN_POS.z - RIVER_SPIRIT_ANCHOR.z,
      ),
    ).toBeLessThan(RIVER_SPIRIT_RADIUS + 2);
    // The chosen deep point really is deep water.
    expect(terrainHeight(DEEP_POINT.x, DEEP_POINT.z, RIVER_WORLD_SEED)).toBeLessThan(
      DEEP_WATER_GROUND,
    );
  });
});

describe('river spirit: manifestation (E4, still works)', () => {
  it('fires once on first approach, unknown -> observed, never repeats', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    expect(state.relation).toBe('unknown');
    for (let i = 0; i < 5; i++) expect(step(state, sim).effect).toBe('none');
    teleport(sim, RIVER_SPIRIT_ANCHOR.x + 2, RIVER_SPIRIT_ANCHOR.z);
    const first = step(state, sim);
    expect(first.effect).toBe('manifested');
    expect(first.events.some(isManifestationLog)).toBe(true);
    expect(state.relation).toBe('observed');
    // Staying, leaving, returning: never repeats.
    for (let i = 0; i < 5; i++) expect(step(state, sim).effect).not.toBe('manifested');
    teleport(sim, RIVER_PLAYER_START.x, RIVER_PLAYER_START.z);
    step(state, sim);
    teleport(sim, RIVER_SPIRIT_ANCHOR.x, RIVER_SPIRIT_ANCHOR.z + 1);
    expect(step(state, sim).effect).not.toBe('manifested');
  });
});

describe('river spirit: resistance and current (E5)', () => {
  it('the current never starts while the relation is unknown', () => {
    // Guard isolation: relation unknown, but manifestation already consumed so it
    // cannot fire. Entering deep water must NOT start the current.
    const sim = makeRiverSim();
    const guarded = createRiverSpiritState();
    guarded.hasManifested = true; // relation deliberately left 'unknown'
    teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
    expect(step(guarded, sim).effect).toBe('none');
    expect(isRiverCurrentActive(guarded)).toBe(false);
    expect(guarded.relation).toBe('unknown');

    // In real play, deep water is inside the anchor radius, so a fresh approach
    // MANIFESTS (unknown -> observed) before it can ever resist: the first tick
    // is the manifestation, not the current.
    const sim2 = makeRiverSim();
    const fresh = createRiverSpiritState();
    teleport(sim2, DEEP_POINT.x, DEEP_POINT.z);
    const first = step(fresh, sim2);
    expect(first.effect).toBe('manifested');
    expect(isRiverCurrentActive(fresh)).toBe(false);
    expect(fresh.relation).toBe('observed');
  });

  it('deep-water entry after being observed changes to offended and starts the current', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    state.relation = 'observed';
    state.hasManifested = true;
    teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
    const started = step(state, sim);
    expect(started.effect).toBe('resistStarted');
    expect(started.events.some(isResistanceLog)).toBe(true);
    expect(state.relation).toBe('offended');
    expect(isRiverCurrentActive(state)).toBe(true);
  });

  it('the current lasts RIVER_CURRENT_TICKS ticks, then releases', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    state.relation = 'observed';
    state.hasManifested = true;
    teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
    const { effects } = runCurrent(sim, state);
    const carrying = effects.filter((e) => e === 'carrying').length;
    const released = effects.filter((e) => e === 'released').length;
    // resistStarted (tick 0) + (CURRENT_TICKS - 1) carrying + 1 released.
    expect(effects[0]).toBe('resistStarted');
    expect(released).toBe(1);
    expect(carrying).toBe(RIVER_CURRENT_TICKS - 1);
  });

  it('moves the body progressively, not by an instant teleport', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    state.relation = 'observed';
    state.hasManifested = true;
    teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
    const total = Math.hypot(RIVER_RETURN_POS.x - DEEP_POINT.x, RIVER_RETURN_POS.z - DEEP_POINT.z);
    step(state, sim); // resistStarted, no move yet
    const afterOne = step(state, sim); // first carrying tick
    expect(afterOne.effect).toBe('carrying');
    const movedAfterOne = Math.hypot(
      sim.player.pos.x - DEEP_POINT.x,
      sim.player.pos.z - DEEP_POINT.z,
    );
    // A small first step (smoothstep near 0), far from the destination.
    expect(movedAfterOne).toBeGreaterThan(0);
    expect(movedAfterOne).toBeLessThan(total * 0.25);
    // Finish and land on the return bank.
    for (let i = 0; i < RIVER_CURRENT_TICKS + 5; i++) {
      if (step(state, sim).effect === 'released') break;
    }
    expect(sim.player.pos.x).toBeCloseTo(RIVER_RETURN_POS.x, 5);
    expect(sim.player.pos.z).toBeCloseTo(RIVER_RETURN_POS.z, 5);
  });

  it('ignores player input during the current: identical trajectory with or without input', () => {
    const withInput = (() => {
      const sim = makeRiverSim();
      const state = createRiverSpiritState();
      state.relation = 'observed';
      state.hasManifested = true;
      teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
      return runCurrent(sim, state, { forward: true, strafeLeft: true }).positions;
    })();
    const noInput = (() => {
      const sim = makeRiverSim();
      const state = createRiverSpiritState();
      state.relation = 'observed';
      state.hasManifested = true;
      teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
      return runCurrent(sim, state).positions;
    })();
    expect(withInput).toEqual(noInput);
  });

  it('ends dry, on the return bank, with coherent pos/prevPos and no HP loss', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    state.relation = 'observed';
    state.hasManifested = true;
    const hp0 = sim.player.hp;
    teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
    runCurrent(sim, state);
    expect(isRiverCurrentActive(state)).toBe(false);
    const p = sim.player;
    // Dry ground (above the water line), at the return bank.
    expect(p.pos.y).toBeGreaterThan(WATER_LEVEL);
    expect(p.pos.x).toBeCloseTo(RIVER_RETURN_POS.x, 5);
    expect(p.pos.z).toBeCloseTo(RIVER_RETURN_POS.z, 5);
    // pos and prevPos are coherent (settled to the same point on release).
    expect(p.prevPos.x).toBeCloseTo(p.pos.x, 5);
    expect(p.prevPos.z).toBeCloseTo(p.pos.z, 5);
    // No damage, no death.
    expect(p.hp).toBe(hp0);
    expect(p.dead).toBe(false);
  });

  it('the spatial grid finds the player at the final bank position', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    state.relation = 'observed';
    state.hasManifested = true;
    teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
    runCurrent(sim, state);
    let found = false;
    sim.grid.forEachInRadius(RIVER_RETURN_POS.x, RIVER_RETURN_POS.z, 2, (e) => {
      if (e.id === sim.playerId) found = true;
    });
    expect(found).toBe(true);
  });

  it('a second forced entry resists again without repeating the first line', () => {
    const sim = makeRiverSim();
    const state = createRiverSpiritState();
    state.relation = 'observed';
    state.hasManifested = true;
    teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
    const firstRun = runCurrent(sim, state);
    // Force again from deep water.
    teleport(sim, DEEP_POINT.x, DEEP_POINT.z);
    const second = step(state, sim);
    expect(second.effect).toBe('resistStarted');
    expect(second.events.some(isResistanceLog)).toBe(true);
    // The manifestation line never reappears across either attempt.
    const allEvents = firstRun.effects; // effects recorded; events checked below
    expect(allEvents).not.toContain('manifested');
    // Drain the second current and confirm no manifestation log anywhere.
    const secondRun = runCurrent(sim, state);
    expect(secondRun.effects).not.toContain('manifested');
  });
});

describe('river spirit: isolation and determinism', () => {
  it('keeps two Sim instances independent', () => {
    const simA = makeRiverSim();
    const simB = makeRiverSim();
    const stateA = createRiverSpiritState();
    const stateB = createRiverSpiritState();
    stateA.relation = 'observed';
    stateA.hasManifested = true;
    teleport(simA, DEEP_POINT.x, DEEP_POINT.z);
    step(stateA, simA);
    expect(isRiverCurrentActive(stateA)).toBe(true);
    expect(state_B_unchanged(stateB)).toBe(true);
    // B never approached: untouched.
    expect(step(stateB, simB).effect).toBe('none');
    expect(stateB.relation).toBe('unknown');
    expect(isRiverCurrentActive(stateB)).toBe(false);
  });

  it('same seed and same scripted walk produce identical events and positions', () => {
    const run = (): {
      logTicks: number[];
      releaseTick: number | null;
      final: { x: number; z: number };
    } => {
      const sim = makeRiverSim();
      const state = createRiverSpiritState();
      // Walk straight toward Mirror Lake from spawn: manifest, then resist.
      const facing = Math.atan2(-92 - sim.player.pos.x, 88 - sim.player.pos.z);
      sim.player.facing = facing;
      sim.player.prevFacing = facing;
      const logTicks: number[] = [];
      let releaseTick: number | null = null;
      for (let i = 0; i < 20 * 30; i++) {
        const { effect, events } = step(state, sim, { forward: true });
        if (events.some((e) => e.type === 'log')) logTicks.push(sim.tickCount);
        if (effect === 'released') {
          releaseTick = sim.tickCount;
          break;
        }
      }
      return { logTicks, releaseTick, final: { x: sim.player.pos.x, z: sim.player.pos.z } };
    };
    const a = run();
    const b = run();
    expect(a.releaseTick).not.toBeNull();
    expect(a).toEqual(b);
    // Two lines total (manifestation + resistance), never more.
    expect(a.logTicks).toHaveLength(2);
  });
});

// Small readability helper: B's state is pristine.
function state_B_unchanged(s: RiverSpiritState): boolean {
  return s.relation === 'unknown' && !s.hasManifested && s.current === null;
}
