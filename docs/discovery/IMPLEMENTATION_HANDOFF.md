# Implementation Handoff: "O Rio" vertical slice (through E8)

Operational handoff so a new agent can continue without re-reading the session.
Background lives in `SHAMANIC_REPOSITORY_AUDIT.md` and
`RIVER_VERTICAL_SLICE_DESIGN.md` (this file does not repeat them).

## 1. Slice in 5 lines
A Neofito (technical placeholder class: `warrior`) spawns alone on the Eastbrook
Vale shore of Mirror Lake, offline, no login/server/DB. A territorial presence
(the river) notices him; there are three spatial ways across: read the shallow
ford, offer at the shore stone, or force the deep channel (which seizes the body
and sweeps it back). The river keeps a five-state memory of the relationship. The
slice tests whether reciprocity and territorial agency produce play, not text. No
combat, no quest, no permanent power.

## 2. Branch and working tree
- Branch: `discovery/shamanic-game`.
- Working tree: clean (E8 committed). `origin`/`upstream` set; no push done.
- Note: `git core.autocrlf=true` on this Windows checkout; commits store LF (the
  "LF will be replaced by CRLF" warnings are expected and harmless).

## 3. Commit chain (short hash + what)
- `ce5ffb41` feat(shamanic): add isolated river slice entry (E1).
- `b697703a` refactor(sim): allow injected initial world content (E2:
  `InitialWorldContent` seam + `DEFAULT_WORLD_CONTENT`).
- `963a08eb` feat(shamanic): bootstrap minimal offline river world (E3).
- `3da9533e` feat(shamanic): add first river manifestation (E4).
- `08308b53` feat(shamanic): add river resistance and current (E5).
- `b34dca69` feat(shamanic): add three river relationship paths (E6).
- `611cf8d9` feat(shamanic): prepare river slice for playtesting (E7).
- `7a0b9bf0` feat(shamanic): add localized river presence (E8).
- Non-slice: `da42ae68` fix(build) CRLF browserslist; `b8d3cb16` docs audit +
  design; `76c07ba3` docs handoff through E5 (this file, now updated for E8).

## 4. Current architecture
- **`river.html`** (repo root, isolated Vite entry, `noindex`): `#game-canvas`,
  `#nameplates`, `#river-veil` (CSS screen tint), `#river-message` (narrative
  line), `#river-hint` (E7 contextual interaction cue), `#river-boot` (loading
  overlay), + inline CSS. Loads only `/src/river_main.ts`.
- **`src/river_main.ts`**: the slice bootstrap. Does NOT reuse `src/main.ts`
  `startGame` (that is ~1700 lines coupled to landing DOM + full HUD, with
  module-scope side effects). Composes public seams directly: `new Sim({ seed,
  playerClass:'warrior', playerName:'Neofito', world: RIVER_INITIAL_WORLD_CONTENT
  })`, `Renderer(sim, canvas, nameplates)`, `Input`/`Keybinds`, `camera_follow`,
  `assetsReady`. Fixed-step offline loop (`DT`, 20 Hz, accumulator). No HUD.
  Exposes `window.__river = { sim, renderer, input, spirit }` for E2E. Owns
  `showRiverMessage()`/`breatheRiverVeil()` and the E7 cue meshes (added to
  `renderer.scene`) + hint/conclusion wiring. Wires `onUiKey('interact')` ->
  `attemptOffer` (default interact key = `F`).
- **`InitialWorldContent`** (`src/sim/types.ts`, E2 seam): optional
  `SimConfig.world` (`npcs, camps, groundObjects, dungeons, delves, playerStart`).
  Unset -> `DEFAULT_WORLD_CONTENT` (`src/sim/data.ts`). Terrain, ZONES,
  MOBS/ITEMS/QUESTS and the DUNGEONS/DELVES registries are NOT injectable (stay
  module globals; the renderer still draws the shipped vale terrain + props).
- **`RIVER_INITIAL_WORLD_CONTENT`** (`src/sim/content/river/initial_world.ts`):
  frozen, MMO-empty, `playerStart = RIVER_PLAYER_START (-45, 60)`; exports
  `RIVER_WORLD_SEED = 20061`. Never merged into `data.ts`.
- **`src/sim/encounters/river_spirit.ts`**: the presence, sim-pure (no DOM, no
  `Math.random`, no wall clock, no rng). The source of truth for relation,
  `hasToken`, crossings, current. Exports `createRiverSpiritState`,
  `updateRiverSpirit(state, host): RiverSpiritEffect`, `attemptOffer(state,
  host): RiverOfferOutcome`, `isRiverCurrentActive`, plus all coords/lines/colors.
- **`src/river_hints.ts`** (E7, presentation-only, DOM-free, tested): the initial
  and conclusion lines, `RIVER_OFFER_HINT_TEXT`, and pure predicates
  `offerHintVisible(hasToken,px,pz)`, `tokenStonesVisible(hasToken)`,
  `isCrossingEffect(effect)`. Reads the module's truth; never holds geometry.
- **Host-driven flow**: the bootstrap calls `updateRiverSpirit(state, sim)` once
  BEFORE each `sim.tick()`; `attemptOffer` is edge-triggered by the interact key.
  Nothing in `Sim`/`SimContext`/tick order references the module (parity gate
  never sees it). The module touches the player only through the public Sim
  surface (`player` entity `pos/prevPos/vx/vz/vy`, `groundPos`, `rebucket`,
  `emit`, `tickCount`, `playerId`) via a structural `RiverSpiritHost` (a full
  `Sim` satisfies it).

## 5. Final relation machine (five states)
`RiverRelation = 'unknown' | 'observed' | 'authorized' | 'offended' | 'reconciled'`.
- `unknown -> observed`: the manifestation, on first entry to the anchor radius.
- `observed -> authorized`: an accepted offer (token at the stone).
- `observed -> offended`: forcing the deep channel (current fires).
- `offended -> reconciled`: humbly crossing the ford after offending.
Deep-channel current fires only when relation is `observed` or `offended`;
`authorized` and `reconciled` permit the deep channel (`deepChannelPermitted`).
`reconciled` keeps the memory and never becomes `authorized`.

**E8 verification of the `offended -> reconciled` sequence (playtest concern).**
Re-read and re-tested against E6: after offending and being swept back, a later
deep-channel passage is permitted ONLY because crossing the ford transitions
`offended -> reconciled` (river_spirit.ts step 4), and `reconciled` is one of the
two relations in `deepChannelPermitted`. Reaching the far margin grants NO
permission by itself: `beyondFarShore` is used purely for crossing-event edge
detection, never to gate the channel. There is no unlock-by-arrival. The behavior
is coherent with the E6 design and was left unchanged; a regression test in
`tests/river_presence_visual.test.ts` pins it (a far-shore arrival while still
`observed` stays `observed`, a ford crossing, not a reconciliation).

## 6. The three paths
- **Observe**: walk the south shore to the shallow ford and wade it (never deep,
  so the current never fires). Relation stays `observed`. Reaching the far bank
  emits `'crossedFord'`.
- **Offer**: walk over the river stones to gather the token (`hasToken`), carry
  it to the shore stone, press interact -> `attemptOffer`. In `observed` ->
  `authorized` (token consumed), and the deep channel no longer seizes the body;
  in `offended` the same offer is refused (token kept); away from the stone
  `'tooFar'`, without the token `'empty'`. Reaching the far bank while authorized
  emits `'crossedOpen'`.
- **Force**: E5 intact. Deep water while `observed`/`offended` -> `offended` +
  current -> swept to `RIVER_RETURN_POS` -> control returned. No damage/death.
- **Reconcile**: after offending, crossing the ford emits `'reconciled'`
  (`offended -> reconciled`); the deep channel then permits passage but the water
  "does not forget". No XP/gold/item/ability is ever granted (verified by test).

## 7. Positions, coordinates, lines (in `river_spirit.ts` unless noted)
- `RIVER_WORLD_SEED = 20061`; `RIVER_PLAYER_START = (-45, 60)` (in
  `initial_world.ts`). Terrain is the vale heightfield placeholder.
- `RIVER_SPIRIT_ANCHOR = (-67, 73)` = the offering stone; `RIVER_SPIRIT_RADIUS =
  12`; `RIVER_OFFERING_STONE = (-67, 73)`, `RIVER_OFFERING_RADIUS = 5`.
- `RIVER_TOKEN_SPOT = (-52, 66)`, `RIVER_TOKEN_RADIUS = 4` (loose river stones).
- `RIVER_FORD_CENTER = (-99, 62)`: validated shallow neck (z=62, x ~ -96..-102,
  no deep cell), the only wadeable crossing. `RIVER_FAR_SHORE_X = -106`: dry
  ground at/ beyond this x = crossed.
- `RIVER_RETURN_POS = (-58, 68)` (current deposits here); `RIVER_CURRENT_TICKS =
  50` (2.5s).
- Deep-water predicate: `groundHeight(x,z) < WATER_LEVEL - PLAYER_SWIM_DEPTH`
  (`-4.5 - 0.8 = -5.3`). Mirror Lake center `(-92, 88)`, radius 30.
- Lines (all Portuguese, slice-owned): manifestation "A água percebe sua pressa.";
  resistance "A água não abre caminho."; token "Você recolhe pedras do leito.";
  offer accepted "A água abre caminho."; refused "A água devolve o que você
  oferece."; empty "Suas mãos estão vazias."; ford "Onde a água é rasa, ela deixa
  passar."; opened "A água se abre para você."; reconciled "A água cede, mas não
  esquece."; initial "Encontre um caminho para a outra margem." (`river_hints.ts`);
  conclusion "A outra margem o recebe." (`river_hints.ts`).

## 8. Interaction key and behavior
- Interact = default keybind `F` (`KeyF`, `src/game/keybinds.ts`), wired in the
  slice's `InputCallbacks.onUiKey`; sets `pendingInteract`, consumed once per
  frame by `attemptOffer`. The `#river-hint` ("Interagir (F)") shows only while
  `hasToken` AND within `RIVER_OFFERING_RADIUS` of the stone; hides on leaving or
  after the offer (token consumed). Global `Input`/controls untouched.

## 9. E7 visual cues + UI (presentation, in the slice only)
- **Procedural stones in `renderer.scene`** (never a Sim entity, never loot): a
  grey cluster at `RIVER_TOKEN_SPOT` (hidden once `hasToken`, via
  `cues.tokenStones.visible = tokenStonesVisible(...)`), and pale stones poking
  above the shallow `RIVER_FORD_CENTER` neck so the crossing reads to the eye.
  Deterministic layout (fixed offsets, no rng).
- **`#river-hint`** DOM element (small pill, CSS `.show`), toggled by
  `offerHintVisible`.
- **Initial orientation**: `showRiverMessage(RIVER_INITIAL_HINT)` once at boot.
- **Conclusion**: on the first `isCrossingEffect(effect)`, schedule
  `RIVER_CONCLUSION_LINE` once (~5.5s after, so the path line shows first).

## 9b. E8 localized river presence (first experimental visual manifestation)
The playtest concern was that the river reacts in logic and text but the place
still looks like plain water. E8 adds a small, deliberately incomplete presence
in the 3D scene. NOT the final art direction, NOT an NPC.
- **`src/river_presence_visual.ts`** (new, slice layer, may use THREE): holds a
  DOM/THREE-free, unit-tested state -> mode mapping (`riverPresenceMode(relation,
  hasManifested, currentActive)`), the per-mode parameter table
  (`RIVER_PRESENCE_PARAMS`), `presenceVisibleForMode`, `RIVER_PRESENCE_CENTER =
  (-73, 77)`, and a small `RiverPresence` THREE class (`createRiverPresence`).
- **Shape**: a `THREE.Group` added to `renderer.scene` with three combined
  elements kept small: expanding water-surface pulse rings, a soft breathing core
  glow, and a few rising particles (deterministic layout, no rng). All materials
  are transparent + additive + `depthWrite:false`.
- **Placement**: over the water immediately lakeward of `RIVER_SPIRIT_ANCHOR`, at
  `(-73, 77)` on the `WATER_LEVEL` plane. Validated for seed 20061 as water
  (groundHeight -5.03 < WATER_LEVEL) and within `RIVER_SPIRIT_RADIUS` of the
  anchor, so it is in view when the river first notices the player.
- **Integration** (`src/river_main.ts`): `createRiverPresence(renderer.scene)`
  once at boot; each animation frame `presence.setMode(riverPresenceMode(...))` +
  `presence.update(frameDt)`. Exposed on `window.__river.presence` for E2E. The
  mapping READS the river state only; it never mutates the sim.
- **Invariants honored**: never a Sim entity, never in the spatial grid, never a
  collider (cannot block movement or camera), no loot/quest/NPC/ability, no
  IWorld/Sim/server/protocol/general-renderer/terrain change, no new dependency.
  The sim-pure `river_spirit.ts` is untouched and stays the source of truth.

### Visual behavior per state (eased transitions, so it appears/calms smoothly)
- `dormant` (before manifestation): hidden (opacity 0).
- `observed`: curious, soft, slow breath, gentle cyan.
- `offended` (and while the current is active, the resistance in motion):
  turbulent, high amplitude, fast pulse, rings pulled in tight (closed).
- `authorized`: calmer and brighter, the rings reach wide (open).
- `reconciled`: contained calm that keeps a trace of tension (quieter than
  observed, cooler and slightly more restless than authorized).

## 10. Tests and minimal commands
- `tests/river_spirit.test.ts` (23, E4+E5+E6): manifestation, resistance/current,
  the three paths + reconcile, authorized/reconciled suppression, no permanent
  reward, isolation, determinism.
- `tests/river_hints.test.ts` (E7): the three pure presentation predicates.
- `tests/river_presence_visual.test.ts` (E8, 12 tests): the state -> visual-mode
  mapping (dormant before manifestation; the active current reads as offended;
  each settled relation maps to its own face), the per-mode parameter distinctions
  (dormant hidden; offended vs observed; authorized vs reconciled), the
  presence-center-over-water invariant, and a scripted manifest -> force -> sweep
  -> ford crossing that pins the E6 `offended -> reconciled` sequence unchanged
  (presentation derived, never a driver) plus the no-unlock-by-arrival guard.
- `tests/river_world_content.test.ts`, `tests/world_content.test.ts` (seam/spawn),
  `tests/architecture.test.ts` (sim purity).
- Focused regression (all green at E8):
  `npx vitest run tests/river_presence_visual.test.ts tests/river_spirit.test.ts tests/river_hints.test.ts tests/river_world_content.test.ts tests/world_content.test.ts tests/architecture.test.ts --testTimeout=60000`
- `npm run check:ts`; `npm run build` (then restore generated artifacts:
  i18n `resolved.generated`, `guide/content.generated.ts`,
  `render/assets/manifest.generated.ts`, `i18n.status.summary.json`). Parity only
  if the Sim core / tick order is touched (E1-E7 never were).
- Browser: `.claude/launch.json` config `dev` runs `npm --prefix
  world-of-claudecraft run dev` on :5173; open `/river.html`. E2E via
  `window.__river` (now includes `spirit`). (`.claude/*` is gitignored.)

## 11. Known limitations after E8
- The E8 presence is a first experimental pass, NOT the art direction: additive
  rings/glow/particles, no true water shader, no reflection/refraction, no
  displacement of the actual water surface. State transitions are eased param
  lerps, not authored animation. It is intentionally subtle and reads best when
  the player is near the anchor facing the lake; from a distance it is faint.
- The presence sits at a fixed water point (`RIVER_PRESENCE_CENTER`); it does not
  follow the player, the ford, or the offering stone, and there is a single
  presence per session. It is decorative feedback, not a spatial guide.
- No audio accompanies the presence.
- The current ignores static collision (straight line), may pass through a tree
  for ~2.5s (visual only; RETURN validated dry).
- Cues/veil/message are screen-space or simple scene stones; the E8 presence is
  the only state-reactive 3D element and it reads the presence state client-side,
  not via IWorld (deliberately avoided; no water shader).
- No audio. No HUD (movement + camera + message/hint only); no click-to-move,
  gamepad, touch, or settings. Interact is keyboard `F` only.
- Terrain/ZONES/props are the shipped globals; the slice lives in the vale
  heightfield and the shipped world's props still render (e.g. distant huts).
- Offer requires the token gathered by proximity + the `F` key; a player who
  never finds the stones/key can still cross via the ford (observe).
- `releasePlayerSpirit` (death) targets the shipped graveyard, but death is
  unreachable in the slice (no hostiles).

## 12. Invariants and prohibitions (unchanged)
- No auxiliary agents/subagents; no general repo audit; read only what the step
  needs; one step per commit.
- Do NOT change `IWorld`, server, wire protocol, `Sim` core, general renderer,
  global terrain, classes, or progression without proven need. The presence stays
  a host-driven, sim-pure module; presentation reflects its state client-side (no
  IWorld fields for river state; no geometry inside `river_spirit.ts`).
- No CraftPix assets. Restore build-regenerated artifacts before committing.

## 13. Playtest readiness (after E8)
Ready for a new human playtest. The full loop is playable and coherent (arrive,
be noticed, negotiate the crossing three distinct spatial ways with territorial
memory; no combat, no permanent reward), and E8 adds the first in-space signal
that a presence inhabits the water, so "the river noticed me" no longer depends
only on the HUD text. Verified: check:ts clean, build green (generated artifacts
restored), the focused test set green (64 + 14 across the river suites), and a
single in-browser smoke in `/river.html` confirmed the localized manifestation is
visible on the water, turns turbulent under resistance, does not block movement or
camera, leaves the E7 texts/cues working, keeps the console clean of slice errors,
and leaves `/` (the original game) functional. The observe path was validated
end-to-end in-browser; offer/force/reconcile are covered by deterministic tests
and the smoke. Open question for the playtest: is the presence legible enough, or
too subtle, at the distance/angle the player actually approaches?

## 14. Next step: decide after a new playtest (do NOT pre-implement)
Run a fresh human playtest of `/river.html` focused on whether the E8 presence is
perceived (see the questions below, plus "did the water itself feel alive?").
Then choose ONE direction as a post-playtest decision, do not start it
speculatively:
- **Refine the river manifestation**: tune legibility/intensity/animation of the
  E8 presence (still no shader system, still the vertical slice).
- **Prototype a second kind of presence**: a tree, a stone, or an animal, to test
  whether the "inhabited place" pattern generalizes beyond the river.
- **Begin structuring the first journey and its characters**: move from a single
  encounter toward a small authored arc.
Fix only problems a playtest surfaces (small, targeted); one step per commit.

## 15. Questions the playtest must answer
- Did the player find the ford (the shallow southern neck)?
- Did they notice the river stones (token) and the ford stones?
- Did they understand where/how to interact (the offering)?
- Did they perceive that the river reacted to their conduct?
- Did they notice the E8 presence in the water, and did it change with the river's
  mood (curious vs turbulent vs open vs contained)?
- Did they describe the crossing as a relationship, or as a puzzle?
