# Implementation Handoff — "O Rio" vertical slice (through E5)

Operational handoff so a new agent can continue at E6 without re-reading the
session. Background lives in `SHAMANIC_REPOSITORY_AUDIT.md` and
`RIVER_VERTICAL_SLICE_DESIGN.md` (this file does not repeat them).

## 1. Slice in 5 lines
A Neofito (technical placeholder class: `warrior`) spawns alone on the Eastbrook
Vale shore of Mirror Lake, offline, no login/server/DB. Walking to the shore, a
territorial presence (the river) notices him. Forcing the deep water without a
relationship makes the current seize the body and sweep it back to the bank. The
slice tests whether reciprocity and territorial agency produce play, not text.
No combat, no quest, no permanent power.

## 2. Branch and working tree
- Branch: `discovery/shamanic-game`.
- Working tree: clean (E5 committed). `origin`/`upstream` set; no push done.
- Note: `git core.autocrlf=true` on this Windows checkout; commits store LF (the
  "LF will be replaced by CRLF" warnings are expected and harmless).

## 3. Commit chain E1–E5 (short hash + what)
- `ce5ffb41` feat(shamanic): add isolated river slice entry (E1: `river.html` +
  `src/river_main.ts` + `vite.config.ts` entry).
- `b697703a` refactor(sim): allow injected initial world content (E2:
  `InitialWorldContent` seam + `DEFAULT_WORLD_CONTENT`).
- `963a08eb` feat(shamanic): bootstrap minimal offline river world (E3: content
  pack + real offline bootstrap; player-only vale).
- `3da9533e` feat(shamanic): add first river manifestation (E4: anchor +
  one-time manifestation + slice message/veil).
- `08308b53` feat(shamanic): add river resistance and current (E5: relation
  states + deep-water resistance + current + input block).
- (Also, not slice code: `da42ae68` fix(build) CRLF browserslist; `b8d3cb16`
  docs discovery audit + design.)

## 4. Current architecture
- **`river.html`** (repo root, isolated Vite entry, `noindex`): `#game-canvas`,
  `#nameplates`, `#river-veil` (CSS screen tint), `#river-message` (one-line
  surface), `#river-boot` (loading overlay), + inline CSS for veil/message.
  Loads only `<script type="module" src="/src/river_main.ts">`.
- **`src/river_main.ts`**: the slice bootstrap. Does NOT reuse `src/main.ts`
  `startGame` (that is ~1700 lines coupled to landing DOM + full HUD, with
  module-scope landing side effects). It composes public seams directly: `new
  Sim({ seed, playerClass:'warrior', playerName:'Neofito', world:
  RIVER_INITIAL_WORLD_CONTENT })`, `Renderer(sim, canvas, nameplates)`,
  `Input`/`Keybinds`, `camera_follow` helpers, `assetsReady`. Fixed-step offline
  loop (`DT`, 20 Hz, accumulator). No HUD mounted. Exposes `window.__river =
  { sim, renderer, input }` for E2E. Owns `showRiverMessage()`/`breatheRiverVeil()`
  (CSS class toggles on the two elements).
- **`InitialWorldContent`** (`src/sim/types.ts`, E2 seam): optional
  `SimConfig.world`; fields `npcs, camps, groundObjects, dungeons, delves,
  playerStart`. Unset -> `DEFAULT_WORLD_CONTENT` (`src/sim/data.ts`, aliases the
  shipped tables). The Sim constructor's population loops + `addPlayer`
  fresh-start read `this.cfg.world`. Terrain, ZONES, MOBS/ITEMS/QUESTS and the
  DUNGEONS/DELVES registries are NOT injectable (stay module globals).
- **`RIVER_INITIAL_WORLD_CONTENT`** (`src/sim/content/river/initial_world.ts`):
  frozen, MMO-empty (all arrays/records empty), `playerStart = RIVER_PLAYER_START
  (-45, 60)`. Also exports `RIVER_WORLD_SEED = 20061`. Never merged into
  `data.ts`; only the river entry + its tests import it.
- **`src/sim/encounters/river_spirit.ts`**: the presence, sim-pure (no DOM, no
  `Math.random`, no wall clock, no rng). Holds `RiverSpiritState`; exports
  `createRiverSpiritState`, `updateRiverSpirit(state, host): RiverSpiritEffect`,
  `isRiverCurrentActive(state)`, plus anchor/return/line/color/tick constants.
- **Host-driven flow**: the bootstrap calls `updateRiverSpirit(state, sim)` once
  BEFORE each `sim.tick()`. Nothing in `Sim`/`SimContext`/tick-phase order
  references the module, so the shipped game and the parity gate never see it.
  The module reads/writes the player only through the public Sim surface
  (`player` entity `pos/prevPos/vx/vz/vy`, `groundPos`, `rebucket`, `emit`,
  `tickCount`, `playerId`) via a structural `RiverSpiritHost` interface (a full
  `Sim` satisfies it). It returns an effect the bootstrap uses to present
  message/veil and to gate input.

## 5. Relation states (implemented)
`RiverRelation = 'unknown' | 'observed' | 'offended'`.
- `unknown`: start. No resistance possible.
- `observed`: set by the E4 manifestation (first entry into the anchor radius).
- `offended`: set by a forced deep-water entry after being observed.
Not yet present: `authorized`, `reconciled` (E6).

## 6. Behavior implemented
- **Manifestation**: once per session, when the player first enters the anchor
  radius; `unknown -> observed`; emits `{type:'log'}` SimEvent; effect
  `'manifested'`.
- **Message**: `showRiverMessage(text)` on `#river-message` (fade in ~1.4s, hold
  ~5.2s, fade out). Two lines so far (see 7).
- **Veil**: `breatheRiverVeil(holdMs)` on `#river-veil` (cool tint eases in/out;
  resistance uses a longer 2900ms breath). Pure CSS, `pointer-events:none`.
- **Deep-water detection**: `groundHeight(x,z) < WATER_LEVEL - PLAYER_SWIM_DEPTH`
  (the sim's own `deepWater`/`isSwimming` predicate), via `host.groundPos(x,z).y`.
  Trigger = perceived (`relation !== 'unknown'`) AND deep water AND current
  inactive. Not distance-based.
- **Current**: tick-driven, `RIVER_CURRENT_TICKS` (50 ticks = 2.5s), eased
  (`smoothstep`) straight line from entry point to `RIVER_RETURN_POS`; effects
  `'resistStarted'` then `'carrying'` then `'released'`. No HP change, no death.
- **Input block**: bootstrap-only. While `isRiverCurrentActive(state)` (or effect
  `'released'`), the loop assigns `emptyMoveInput()` to `sim.moveInput` and does
  not apply facing; camera still follows. Global `Input`/controls untouched.
- **Return to bank**: on the final tick, `pos = groundPos(RETURN)`, `prevPos =
  {...pos}`, velocity zeroed, `rebucket(player)` (the `releasePlayerSpirit`
  primitive). Body emerges from water to dry ground.

## 7. Important constants and coordinates (all in `river_spirit.ts` unless noted)
- `RIVER_WORLD_SEED = 20061` (shared with the shipped world; terrain is the vale
  heightfield placeholder). In `initial_world.ts`.
- `RIVER_PLAYER_START = (-45, 60)` (spawn; `initial_world.ts`). Dry, ~6.9yd above
  water, faces Mirror Lake.
- `RIVER_SPIRIT_ANCHOR = (-67, 73)`, `RIVER_SPIRIT_RADIUS = 12`. Dry shore,
  25.6yd from spawn. Deep water begins ~9yd further toward the lake, so the
  radius is always crossed before deep water (manifestation before resistance).
- `RIVER_RETURN_POS = (-58, 68)`. Dry (h=2.14, ~6.6yd above water), slope 0.53,
  10.3yd from the anchor, not deep (no re-trigger without walking back in).
- `RIVER_CURRENT_TICKS = 50` (2.5s).
- `RIVER_MANIFESTATION_LINE = "A água percebe sua pressa."` (color `#9fd8d4`).
- `RIVER_RESISTANCE_LINE = "A água não abre caminho."` (color `#7fc6d6`).
- Mirror Lake center `(-92, 88)` (from `src/sim/content/zone1.ts` `LAKE`, radius
  30). `WATER_LEVEL = -4.5` (`src/sim/world.ts`), `PLAYER_SWIM_DEPTH = 0.8`
  (`src/sim/pathfind.ts`) -> deep-water ground threshold `-5.3`.

## 8. Files directly relevant to E6
- `src/sim/encounters/river_spirit.ts` — grow the state machine + paths here.
- `src/river_main.ts` — presentation + input gate + any new interaction wiring.
- `src/sim/content/river/initial_world.ts` — if the offering needs a ground
  object OR the ford needs a marker (weigh against loot/quest side effects; an
  injected `groundObject` becomes a lootable sparkle, so prefer territorial state
  in the module unless a real entity is needed).
- `tests/river_spirit.test.ts` — extend (host-driven `step()` idiom already set
  up: update -> gate input -> tick).
- Read-only references for mechanics: `src/sim/world.ts` (`terrainHeight`,
  `WATER_LEVEL`, `zoneBiomeAt`), `src/sim/pathfind.ts` (`PLAYER_SWIM_DEPTH`,
  `PLAYER_MAX_CLIMB_SLOPE`), `src/sim/entity_roster.ts` (`releasePlayerSpirit`
  reposition pattern), `src/sim/types.ts` (`SimEvent` union: `{type:'log'}` is
  the presentation channel).

## 9. Invariants and prohibitions
- No auxiliary agents / subagents / parallel delegation (single-agent steps).
- No general repository audit; read only what the step needs.
- Do NOT change `IWorld`, the server, the wire protocol, or the `Sim` core
  without a proven need. The presence stays a host-driven module; presentation
  reacts to `SimEvent`s client-side (do not add IWorld fields to show river
  state).
- No CraftPix assets (skill icons are licensed to another account). Procedural /
  CC0 GLB only.
- One step per commit; restore build-regenerated artifacts before committing
  (i18n `resolved.generated`, `guide/content.generated.ts`,
  `render/assets/manifest.generated.ts`, `i18n.status.summary.json`).
- Keep the module sim-pure: no DOM, no `Math.random`, no `Date.now`/
  `performance.now`, no rng draws (determinism).

## 10. Tests and minimal commands
- E5 suite: `npx vitest run tests/river_spirit.test.ts` (12 tests, green).
- Seam + spawn: `tests/world_content.test.ts`, `tests/river_world_content.test.ts`.
- Guard: `tests/architecture.test.ts` (scans the sim module for purity).
- Focused regression:
  `npx vitest run tests/river_spirit.test.ts tests/river_world_content.test.ts tests/world_content.test.ts tests/architecture.test.ts --testTimeout=60000`
- Typecheck `npm run check:ts`; official build `npm run build` (then restore
  generated artifacts). Parity (`npx vitest run tests/parity --testTimeout=60000`)
  only if the Sim core / tick order is touched (E5 did not).
- Browser: `.claude/launch.json` config `dev` runs `npm --prefix
  world-of-claudecraft run dev` on :5173; open `/river.html`. E2E via
  `window.__river`. (`.claude/*` is gitignored.)

## 11. Known limitations
- Current ignores static collision (straight line) — may pass through a tree for
  ~2.5s (visual only; RETURN is validated dry).
- Manifestation/veil are screen-space, not localized at the anchor.
- No audio (no trivial gesture-free infra in the slice yet).
- No HUD: only movement + camera + the one-line message. No click-to-move,
  gamepad, touch, or settings.
- Terrain/ZONES are the shipped globals; the slice lives inside the vale
  heightfield and the shipped camps' terrain shaping (not injectable via E2).
- `releasePlayerSpirit` (death) still targets the shipped zone graveyard, but
  death is unreachable in the slice (no hostiles).

## 12. Next step: E6 (definition)
- Add `authorized` and `reconciled` to `RiverRelation`.
- Implement the three crossing paths:
  - **Observe**: active perception of the natural ford (read the water / follow
    cues), not a trigger or a button. Grants passage at the shallow band without
    the river's blessing (relation stays observed).
  - **Offer**: a deliberate give at the bank whose acceptance depends on the
    relational state; on acceptance -> `authorized`, the deep channel calms and
    the current no longer seizes the body there. Not a colored key (observe also
    crosses; the river can refuse/reinterpret).
  - **Force**: keep E5's resistance; a forced attempt entrenches `offended`.
- Preserve the memory of offense: once `offended`, observe/offer must first
  reconcile (`offended -> reconciled`); `reconciled` is authorized-with-memory
  (passage works but the presence stays warier). The first manifestation line
  never repeats.
- No combat, no permanent ability/loot reward; the gain is the river's state,
  never the player's sheet.

## 13. Open questions the E6 agent must actually decide
- **Authorized suppression + visual**: `authorized` must stop the current in the
  deep channel; if the calm water should also LOOK calm, the renderer would need
  to read river state — but IWorld is off-limits. Decide: keep it behavioral +
  `SimEvent`-driven client-side (recommended, matches E1–E5), or accept a minimal
  read path.
- **Ford as real terrain vs scripted passage**: is the "shallow band" a real
  navigable strip in the existing vale heightfield near the anchor (validate with
  `terrainHeight`), or a scripted authorized crossing? Pick one geometry; the
  design proposes one river with a shallow ford + a deep channel.
- **Offering mechanic without inventory/button**: how does the player "give"
  with no HUD and no bag? Candidates: dwell/presence at a bank spot, a proximity
  gesture, or a single takeable natural object (an injected `groundObject` brings
  loot/quest side effects — verify before using). Decide the smallest honest
  mechanic.
- **Observe detection that is not a trigger**: what concrete, testable signal
  proves the player "read" the ford (e.g., reaching the shallow band on foot,
  following a cue) without degenerating into "stand in a radius".
- **Input/UX for interaction**: the slice has no interact key wired
  (`InputCallbacks.onUiKey('interact')` exists in the full game but the slice
  passes no-ops). Decide whether offering needs a key or is purely positional.
