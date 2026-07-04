// "O Rio" vertical slice: the injectable initial world for the isolated river
// entry (river.html -> src/river_main.ts). Deliberately empty of MMO population:
// no npcs, no mob camps, no ground objects, no dungeon doors or instance slots,
// no delve runs. Only the player spawns. Never merged into data.ts; only the
// river entry (and its tests) import this pack, so the shipped game bundle and
// content tables are untouched.
import type { InitialWorldContent } from '../../types';

// Same seed as the shipped world (src/main.ts WORLD_SEED): the slice reuses the
// existing vale heightfield as placeholder terrain, so ground, water line, and
// decoration placement match the known world and stay reproducible. Terrain is
// NOT injectable through InitialWorldContent (it stays a module global by
// design); changing this seed would reshape the whole world, not just the slice.
export const RIVER_WORLD_SEED = 20061;

// Spawn on the Eastbrook Vale meadow southeast of Mirror Lake, chosen and
// numerically validated (tests/river_world_content.test.ts): gentle ground
// (local slope ~0.39, well under PLAYER_MAX_CLIMB_SLOPE), ~6.9yd above the
// water line, ~55yd from the lake basin so real water is a short walk
// northwest, 75yd from the Eastbrook hub and ~128yd from the chapel dungeon
// door. All distances are against the shipped terrain for RIVER_WORLD_SEED.
export const RIVER_PLAYER_START = Object.freeze({ x: -45, z: 60 });

export const RIVER_INITIAL_WORLD_CONTENT: InitialWorldContent = Object.freeze({
  npcs: Object.freeze({}),
  camps: Object.freeze([]),
  groundObjects: Object.freeze([]),
  dungeons: Object.freeze([]),
  delves: Object.freeze([]),
  playerStart: RIVER_PLAYER_START,
});
