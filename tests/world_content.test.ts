// Guards the SimConfig.world seam: the Sim constructor's initial world population
// is injectable (InitialWorldContent), and omitting it must keep spawning the
// shipped world byte-identically (DEFAULT_WORLD_CONTENT references the canonical
// tables, no copies). Three invariants: default preserved, injection takes effect,
// and definition objects are never mutated or shared as runtime state.
import { describe, expect, it } from 'vitest';
import { CAMPS, DEFAULT_WORLD_CONTENT, GROUND_OBJECTS, NPCS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import type { Entity, InitialWorldContent, NpcDef } from '../src/sim/types';

function makeSim(world?: InitialWorldContent): Sim {
  return world
    ? new Sim({ seed: 42, playerClass: 'warrior', world })
    : new Sim({ seed: 42, playerClass: 'warrior' });
}

function entitiesOfKind(sim: Sim, kind: Entity['kind']): Entity[] {
  return [...sim.entities.values()].filter((e) => e.kind === kind);
}

// Small deterministic construction sample: identity, placement, level. Enough to
// prove two constructions are the same world without pinning a giant snapshot.
function sample(sim: Sim): unknown[] {
  return [...sim.entities.values()].map((e) => ({
    id: e.id,
    kind: e.kind,
    templateId: e.templateId,
    x: e.pos.x,
    z: e.pos.z,
    level: e.level,
  }));
}

const MINIMAL: InitialWorldContent = {
  npcs: {},
  camps: [],
  groundObjects: [],
  dungeons: [],
  delves: [],
  playerStart: { x: 30, z: 40 },
};

const TEST_NPC: NpcDef = {
  id: 'world_content_test_guide',
  name: 'Test Guide',
  title: 'Guide',
  pos: { x: 6, z: 2 },
  facing: 0,
  color: 0xffffff,
  questIds: [],
  greeting: 'Hello.',
};

describe('SimConfig.world: default preserved', () => {
  it('omitting world spawns the shipped population (counts derived from the tables)', () => {
    const sim = makeSim();
    // Every non-dynamic NPC def spawns exactly one npc entity, and a known one is there.
    const nonDynamic = Object.values(NPCS).filter((n) => !n.dynamic);
    const npcs = entitiesOfKind(sim, 'npc');
    expect(npcs.length).toBe(nonDynamic.length);
    expect(npcs.some((e) => e.templateId === nonDynamic[0].id)).toBe(true);
    // Camp mobs: one mob per camp count.
    const expectedMobs = CAMPS.reduce((sum, c) => sum + c.count, 0);
    expect(entitiesOfKind(sim, 'mob').length).toBe(expectedMobs);
    // Objects: one per ground-object position plus one door per overworld dungeon.
    const groundObjCount = GROUND_OBJECTS.reduce((sum, o) => sum + o.positions.length, 0);
    const doorCount = DEFAULT_WORLD_CONTENT.dungeons.filter(
      (d) => d.overworldDoor !== false,
    ).length;
    expect(entitiesOfKind(sim, 'object').length).toBe(groundObjCount + doorCount);
    // The player spawns at the shipped start position.
    expect(sim.player.pos.x).toBe(DEFAULT_WORLD_CONTENT.playerStart.x);
    expect(sim.player.pos.z).toBe(DEFAULT_WORLD_CONTENT.playerStart.z);
  });

  it('passing DEFAULT_WORLD_CONTENT explicitly is a no-op vs omitting it', () => {
    const a = makeSim();
    const b = makeSim(DEFAULT_WORLD_CONTENT);
    expect(sample(b)).toEqual(sample(a));
    for (let i = 0; i < 100; i++) {
      a.tick();
      b.tick();
    }
    expect(sample(b)).toEqual(sample(a));
  });
});

describe('SimConfig.world: injected content', () => {
  it('a minimal world spawns no default population and a functional player', () => {
    const sim = makeSim(MINIMAL);
    expect(entitiesOfKind(sim, 'npc').length).toBe(0);
    expect(entitiesOfKind(sim, 'mob').length).toBe(0);
    expect(entitiesOfKind(sim, 'object').length).toBe(0);
    expect(entitiesOfKind(sim, 'player').length).toBe(1);
    // The injected start position is used (groundPos keeps x/z, heights y).
    expect(sim.player.pos.x).toBe(30);
    expect(sim.player.pos.z).toBe(40);
    expect(sim.player.hp).toBeGreaterThan(0);
    // Ticks cleanly, including while moving.
    sim.moveInput.forward = true;
    for (let i = 0; i < 200; i++) sim.tick();
    expect(sim.player.hp).toBeGreaterThan(0);
  });

  it('injected npcs spawn instead of the default ones', () => {
    const sim = makeSim({ ...MINIMAL, npcs: { [TEST_NPC.id]: TEST_NPC } });
    const npcs = entitiesOfKind(sim, 'npc');
    expect(npcs.length).toBe(1);
    expect(npcs[0].templateId).toBe(TEST_NPC.id);
  });

  it('injection is per-field: default npcs survive an empty camp list', () => {
    const sim = makeSim({ ...DEFAULT_WORLD_CONTENT, camps: [] });
    expect(entitiesOfKind(sim, 'mob').length).toBe(0);
    const nonDynamic = Object.values(NPCS).filter((n) => !n.dynamic);
    expect(entitiesOfKind(sim, 'npc').length).toBe(nonDynamic.length);
  });

  it('an injected world is deterministic for a fixed seed', () => {
    const run = () => {
      const sim = makeSim({ ...MINIMAL, npcs: { [TEST_NPC.id]: TEST_NPC } });
      for (let i = 0; i < 100; i++) sim.tick();
      return sample(sim);
    };
    expect(run()).toEqual(run());
  });
});

describe('SimConfig.world: isolation', () => {
  it('deep-frozen definitions construct and tick without any mutation attempt', () => {
    // ESM is strict mode: writing to a frozen object throws, so surviving
    // construction + ticks proves the Sim never mutates the definition data.
    const frozen: InitialWorldContent = Object.freeze({
      npcs: Object.freeze({
        [TEST_NPC.id]: Object.freeze({
          ...TEST_NPC,
          pos: Object.freeze({ ...TEST_NPC.pos }),
          questIds: Object.freeze([]) as unknown as string[],
        }),
      }),
      camps: Object.freeze([]) as InitialWorldContent['camps'],
      groundObjects: Object.freeze([]) as InitialWorldContent['groundObjects'],
      dungeons: Object.freeze([]) as InitialWorldContent['dungeons'],
      delves: Object.freeze([]) as InitialWorldContent['delves'],
      playerStart: Object.freeze({ x: 30, z: 40 }),
    });
    const sim = makeSim(frozen);
    for (let i = 0; i < 100; i++) sim.tick();
    expect(entitiesOfKind(sim, 'npc').length).toBe(1);
  });

  it('two sims sharing one definition object stay independent', () => {
    const a = makeSim(MINIMAL);
    const b = makeSim(MINIMAL);
    a.player.pos.x = 99;
    a.rebucket(a.player);
    for (let i = 0; i < 50; i++) a.tick();
    expect(b.player.pos.x).toBe(30);
    // The shared definition object is untouched by either instance.
    expect(MINIMAL.playerStart.x).toBe(30);
    expect(MINIMAL.camps.length).toBe(0);
  });

  it('constructing and ticking the default world does not mutate the canonical tables', () => {
    const campsLen = CAMPS.length;
    const npcKeys = Object.keys(NPCS).length;
    const objsLen = GROUND_OBJECTS.length;
    const sim = makeSim();
    for (let i = 0; i < 50; i++) sim.tick();
    expect(CAMPS.length).toBe(campsLen);
    expect(Object.keys(NPCS).length).toBe(npcKeys);
    expect(GROUND_OBJECTS.length).toBe(objsLen);
  });
});
