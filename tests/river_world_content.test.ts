// E3 guard for the "O Rio" slice pack (src/sim/content/river/initial_world.ts):
// the pack is empty of MMO population, its spawn sits on safe vale ground for
// the documented seed, and a Sim booted from it holds only the player and ticks
// cleanly. Complements tests/world_content.test.ts (the generic seam guard)
// without repeating it.
import { describe, expect, it } from 'vitest';
import {
  RIVER_INITIAL_WORLD_CONTENT,
  RIVER_PLAYER_START,
  RIVER_WORLD_SEED,
} from '../src/sim/content/river/initial_world';
import { DUNGEON_LIST } from '../src/sim/data';
import { PLAYER_MAX_CLIMB_SLOPE } from '../src/sim/pathfind';
import { Sim } from '../src/sim/sim';
import { terrainHeight, WATER_LEVEL, zoneBiomeAt } from '../src/sim/world';

function makeRiverSim(): Sim {
  return new Sim({
    seed: RIVER_WORLD_SEED,
    playerClass: 'warrior', // technical placeholder, mirrors the entry (see river_main.ts)
    playerName: 'Neofito',
    world: RIVER_INITIAL_WORLD_CONTENT,
  });
}

describe('river slice pack: content', () => {
  it('is empty of MMO population and structurally valid', () => {
    expect(Object.keys(RIVER_INITIAL_WORLD_CONTENT.npcs)).toHaveLength(0);
    expect(RIVER_INITIAL_WORLD_CONTENT.camps).toHaveLength(0);
    expect(RIVER_INITIAL_WORLD_CONTENT.groundObjects).toHaveLength(0);
    expect(RIVER_INITIAL_WORLD_CONTENT.dungeons).toHaveLength(0);
    expect(RIVER_INITIAL_WORLD_CONTENT.delves).toHaveLength(0);
    expect(Number.isFinite(RIVER_PLAYER_START.x)).toBe(true);
    expect(Number.isFinite(RIVER_PLAYER_START.z)).toBe(true);
    expect(RIVER_INITIAL_WORLD_CONTENT.playerStart).toBe(RIVER_PLAYER_START);
  });
});

describe('river slice pack: safe spawn on the shipped terrain', () => {
  it('sits in the vale, above water, on gentle ground', () => {
    const { x, z } = RIVER_PLAYER_START;
    expect(zoneBiomeAt(z)).toBe('vale');
    const h = terrainHeight(x, z, RIVER_WORLD_SEED);
    expect(Number.isFinite(h)).toBe(true);
    // Standing ground, not submerged: comfortably above the swim line.
    expect(h).toBeGreaterThan(WATER_LEVEL + 1);
    // Local slope far below the climb block, so the player can walk off spawn
    // in any direction (central differences over 4yd).
    const dhx =
      (terrainHeight(x + 2, z, RIVER_WORLD_SEED) - terrainHeight(x - 2, z, RIVER_WORLD_SEED)) / 4;
    const dhz =
      (terrainHeight(x, z + 2, RIVER_WORLD_SEED) - terrainHeight(x, z - 2, RIVER_WORLD_SEED)) / 4;
    expect(Math.hypot(dhx, dhz)).toBeLessThan(PLAYER_MAX_CLIMB_SLOPE * 0.5);
  });

  it('is far from every overworld dungeon door of the shipped world', () => {
    const { x, z } = RIVER_PLAYER_START;
    for (const dungeon of DUNGEON_LIST) {
      if (dungeon.overworldDoor === false) continue;
      const d = Math.hypot(dungeon.doorPos.x - x, dungeon.doorPos.z - z);
      expect(d).toBeGreaterThan(60);
    }
  });
});

describe('river slice pack: sim boot', () => {
  it('spawns only the player, at the pack start position, and ticks cleanly', () => {
    const sim = makeRiverSim();
    expect([...sim.entities.values()].map((e) => e.kind)).toEqual(['player']);
    expect(sim.player.pos.x).toBe(RIVER_PLAYER_START.x);
    expect(sim.player.pos.z).toBe(RIVER_PLAYER_START.z);
    expect(sim.player.pos.y).toBeGreaterThan(WATER_LEVEL);
    // Walk forward for 10 seconds of sim time: nothing hostile exists, nothing
    // throws, and the frozen pack proves the sim never mutates the definitions.
    sim.moveInput.forward = true;
    for (let i = 0; i < 200; i++) sim.tick();
    expect(sim.player.hp).toBe(sim.player.maxHp);
  });

  it('is deterministic for the documented seed', () => {
    const run = (): { x: number; y: number; z: number } => {
      const sim = makeRiverSim();
      sim.moveInput.forward = true;
      for (let i = 0; i < 100; i++) sim.tick();
      return { x: sim.player.pos.x, y: sim.player.pos.y, z: sim.player.pos.z };
    };
    expect(run()).toEqual(run());
  });
});
