# Implementation Handoff: "O Rio" vertical slice (through E11)

Operational handoff so a new agent can continue without re-reading the session.
Background lives in `SHAMANIC_REPOSITORY_AUDIT.md` and
`RIVER_VERTICAL_SLICE_DESIGN.md` (this file does not repeat them).

## 1. Slice in 5 lines
A Neofito (technical placeholder class: `priest`, rendered as a plain unarmed robe;
E11) spawns alone on the Eastbrook Vale shore of Mirror Lake, offline, no
login/server/DB. A territorial presence
(the river) notices him; there are three spatial ways across: read the shallow
ford, offer at the shore stone, or force the deep channel (which seizes the body
and sweeps it back). The river keeps a five-state memory of the relationship. The
slice tests whether reciprocity and territorial agency produce play, not text. No
combat, no quest, no permanent power.

## 2. Branch and working tree
- Branch: `discovery/shamanic-game`.
- Working tree: clean (E11 committed). `origin`/`upstream` set; no push done.
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
- `d2e63d89` feat(shamanic): add touch controls to river slice (E9).
- `bcb447ae` chore(shamanic): harden river slice local playtest (E10: touch safety
  resets + `dev:lan` script).
- `fe7bd6a5` chore: align package manager configuration (E10: gitignore stray pnpm
  artifacts; npm is canonical).
- `a4ed8cd3` feat(shamanic): improve river presence and neophyte appearance (E11:
  presence to open lake + robed unarmed Neofito).
- Non-slice: `da42ae68` fix(build) CRLF browserslist; `b8d3cb16` docs audit +
  design; `76c07ba3` docs handoff through E5 (this file, now updated for E11).

## 4. Current architecture
- **`river.html`** (repo root, isolated Vite entry, `noindex`): `#game-canvas`,
  `#nameplates`, `#river-veil` (CSS screen tint), `#river-message` (narrative
  line), `#river-hint` (E7 contextual interaction cue), `#river-touch-controls`
  (E9: `#river-joystick`/`#river-joystick-knob` + the `#river-interact` button),
  `#river-boot` (loading overlay), + inline CSS. Loads only `/src/river_main.ts`.
- **`src/river_main.ts`**: the slice bootstrap. Does NOT reuse `src/main.ts`
  `startGame` (that is ~1700 lines coupled to landing DOM + full HUD, with
  module-scope side effects). Composes public seams directly: `new Sim({ seed,
  playerClass: RIVER_NEOPHYTE_CLASS ('priest', E11), playerName:'Neofito', world:
  RIVER_INITIAL_WORLD_CONTENT })`, `Renderer(sim, canvas, nameplates)`,
  `Input`/`Keybinds`, `camera_follow`,
  `assetsReady`. Fixed-step offline loop (`DT`, 20 Hz, accumulator). No HUD.
  Exposes `window.__river = { sim, renderer, input, spirit, presence, touch }`
  for E2E. Owns
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
- **`src/river_neophyte.ts`** (E11, presentation-only, DOM-free, tested): the
  slice's neutral-appearance decisions: `RIVER_NEOPHYTE_CLASS = 'priest'` (the
  existing robed, unarmored, no-pet/no-form class the slice spawns) and the pure
  predicates `isHeldWeaponObject` / `isNeophyteHiddenObject` the entry uses to hide
  the held weapon and the mage-robe hat/cape in its own scene. Never touches the
  global equipment system or the character model.
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
  (-82, 82)` (E11; was (-73, 77)), and a small `RiverPresence` THREE class
  (`createRiverPresence`).
- **Shape**: a `THREE.Group` added to `renderer.scene` with three combined
  elements kept small: expanding water-surface pulse rings, a soft breathing core
  glow, and a few rising particles (deterministic layout, no rng). All materials
  are transparent + additive + `depthWrite:false`.
- **Placement (E11: open lake)**: over the OPEN body of Mirror Lake at `(-82, 82)`
  on the `WATER_LEVEL` plane. Validated for seed 20061 as deep water (groundHeight
  -8.5, ~4yd below WATER_LEVEL) and ~12yd from the lake center, so it reads
  unobstructed from the spawn hill, the descent, the shore, and the crossing. (The
  E8 point (-73, 77) was on the shallow shore shelf (~0.5yd deep) and the relief hid
  it.) The detection anchor and the manifestation trigger are UNCHANGED.
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

## 9c. E9 touch controls (slice-only, makes the tablet playable)
The slice was reachable on the tablet over the LAN but not playable: the bootstrap
only wired keyboard + mouse. E9 adds the smallest touch set, slice-only, NOT a
general mobile system.
- **`src/river_touch_controls.ts`** (new, slice layer): DOM-free pure helpers plus
  a thin Pointer Events class. Pure (unit-tested): `touchControlsShouldShow`,
  `normalizeJoystick` (radial dead zone + magnitude clamp), `joystickMoveFlags`,
  `cameraLookDelta`, `clampCameraPitch` (matches Input's `[-0.4, 1.35]`),
  `mergeMoveInput`, `resolveSliceMoveInput`, `NEUTRAL_JOYSTICK_FLAGS`. Class
  `RiverTouchControls`: tracks pointer ids, moves the knob, writes camera
  yaw/pitch, toggles the interact highlight; pointer capture is try/catch-guarded.
  It NEVER touches the global `Input` class or the sim.
- **Movement mapping**: the left joystick (Pointer Events, touch + pen) produces an
  analog two-axis vector; y -> forward/back, x -> turnLeft/turnRight (matching the
  slice's keyboard W/S + A/D-turn, so it steers without the camera). The slice loop
  OR-merges `touch.moveFlags()` with `input.readMoveInput()` via
  `resolveSliceMoveInput(riverOwnsBody, keyboard, joystick)`; keyboard and touch
  coexist, and while the current owns the body BOTH are blocked (touch respects the
  current). Returns to center on release, clears on `pointercancel` (no stuck move).
- **Camera mapping**: a touch/pen `pointerdown` on the RIGHT half of the canvas
  captures the pointer; per-move pixel deltas apply `camYaw -= dx*sens`,
  `camPitch += dy*sens` (clamped) directly to `input.camYaw/camPitch`. A mouse
  pointer never starts it (desktop coexistence). It never moves the character; the
  slice loop passes `orbiting: touch.isCameraDragging()` so auto-follow does not
  fight the drag. Stops immediately on `pointerup`/`pointercancel`. No pinch zoom.
- **Interaction mapping**: the `#river-interact` ("Interagir") button fires the SAME
  `requestInteract` closure the interact key uses (one `attemptOffer` path, no
  second logic). Highlighted (`.valid`) only when `offerHintVisible(...)` is true;
  dim-but-reachable otherwise so it never reveals where to interact.
- **Visibility rules**: shown only when `pointer: coarse` OR
  `navigator.maxTouchPoints > 0` (never the user agent); on a match the bootstrap
  adds `body.river-touch` and CSS reveals the controls, else they stay
  `display:none`. On a conventional desktop nothing is wired (`touch` is null).
- **Layout/safety** (river.html CSS): `env(safe-area-inset-*)`, `touch-action:none`
  only on the control areas + the game canvas, `user-select:none`, dim/highlight
  contrast, corners kept clear of the narrative message and the river presence, and
  a portrait tweak (landscape prioritized).
- **E10 robustness (safety resets)**: `RiverTouchControls.neutralize()` releases
  both pointers, clears the joystick flags, recenters the knob, and stops the
  camera drag. It runs on the cases where no `pointerup`/`pointercancel` arrives:
  window `blur`, document `visibilitychange` -> hidden, and window
  `orientationchange` (plus the already-handled `pointercancel` and `dispose()`).
  The window/document wiring is `typeof`-guarded so the module still imports under
  Node for the unit tests, and `dispose()` detaches it. No redesign, no new gesture.

## 9d. E11 visual refinements (presence position + neophyte look)
Two playtest-driven fixes; no mechanic, relational-state, or path change.
- **Presence to the open lake**: `RIVER_PRESENCE_CENTER` moved (-73, 77) -> (-82, 82)
  (see 9b). Small readability nudge in `river_presence_visual.ts` (core glow 0.6 ->
  0.85 and lifted to y 0.5; `PARTICLE_RISE` 2.2 -> 2.8), NOT a rescale; the per-mode
  `RIVER_PRESENCE_PARAMS` are untouched.
- **Neutral Neofito (robed, unarmed)**: the slice spawns `RIVER_NEOPHYTE_CLASS`
  (`'priest'`, an existing class) so the character is the mage.glb robe with no
  pet/form, instead of the martial knight. Because mage.glb's `Mage_Hat` and
  `Mage_Cape` are SKINNED meshes that `VisualDef show:[]` cannot strip (and the hat
  brim hides the whole body), `river_main.ts` hides them AND the held weapon in the
  slice's OWN scene: after the first `renderer.sync()` it traverses `renderer.scene`
  once and sets `visible=false` on anything `isNeophyteHiddenObject()` matches
  (`userData.weaponMesh`, or the `Mage_Hat`/`Mage_Cape` names), then stops. Result: a
  plain-robed, bare-headed, unarmed figure. The slice world is MMO-empty, so only the
  player is affected; the global equipment system, the character model, the renderer,
  and the original game at `/` are untouched. Verified on the real model (preview): the
  three meshes hidden are exactly `Mage_Hat`, `Mage_Cape`, `staff_A`; body/head/limbs
  stay visible.

## 10. Tests and minimal commands
- `tests/river_spirit.test.ts` (23, E4+E5+E6): manifestation, resistance/current,
  the three paths + reconcile, authorized/reconciled suppression, no permanent
  reward, isolation, determinism.
- `tests/river_hints.test.ts` (E7): the three pure presentation predicates.
- `tests/river_presence_visual.test.ts` (E8, updated E11, 13 tests): the state ->
  visual-mode mapping (dormant before manifestation; the active current reads as
  offended; each settled relation maps to its own face), the per-mode parameter
  distinctions (dormant hidden; offended vs observed; authorized vs reconciled), the
  E11 center invariant (deep OPEN water, inside the lake, out of the anchor radius),
  and a scripted manifest -> force -> sweep -> ford crossing that pins the E6
  `offended -> reconciled` sequence unchanged plus the no-unlock-by-arrival guard.
- `tests/river_neophyte.test.ts` (E11): `RIVER_NEOPHYTE_CLASS` is an existing, non
  -warrior class (priest); `isHeldWeaponObject` / `isNeophyteHiddenObject` match the
  held weapon and the mage-robe hat/cape and keep the body, never mutating.
- `tests/river_touch_controls.test.ts` (E9 + E10, 31 tests): the pure helpers
  (visibility, joystick normalization / dead zone / magnitude clamp, move mapping,
  camera delta + pitch clamp, the keyboard+touch merge with keyboard preserved, and
  `resolveSliceMoveInput` blocking BOTH inputs during the current) plus a
  fake-element (no jsdom) class pass: return-to-zero on release, `pointercancel`,
  camera delta + stop-on-release, right-half gating, mouse coexistence, the interact
  button firing the shared action, and (E10) the global safety resets (blur / hidden
  tab / orientationchange neutralize; a visible `visibilitychange` does not; dispose
  detaches) via stubbed window/document globals.
- `tests/river_world_content.test.ts`, `tests/world_content.test.ts` (seam/spawn),
  `tests/architecture.test.ts` (sim purity).
- Focused regression (all green at E11):
  `npx vitest run tests/river_neophyte.test.ts tests/river_touch_controls.test.ts tests/river_presence_visual.test.ts tests/river_spirit.test.ts tests/river_hints.test.ts tests/river_world_content.test.ts tests/world_content.test.ts tests/architecture.test.ts --testTimeout=60000`
- `npm run check:ts`; `npm run build` (then restore generated artifacts:
  i18n `resolved.generated`, `guide/content.generated.ts`,
  `render/assets/manifest.generated.ts`, `i18n.status.summary.json`). Parity only
  if the Sim core / tick order is touched (E1-E11 never were). Note: `npm run build`
  can hit a transient Windows `EPERM` renaming an i18n `.tmp` file when another Vite
  dev server holds it open (OneDrive/file-watch lock); just retry, it is not a code
  error.
- Browser: `.claude/launch.json` config `dev` runs `npm --prefix
  world-of-claudecraft run dev` on :5173; open `/river.html`. E2E via
  `window.__river` (now includes `spirit`, `presence`, `touch`). (`.claude/*` is
  gitignored.) For the tablet, run `npm run dev:lan` and open `/river.html` by the
  host's LAN IP (see the package-manager / LAN section).

## 11. Known limitations after E11
- The Neofito's look is PROVISIONAL, not the definitive skin (E11): it is the
  existing priest robe with the hat/cape/weapon hidden in the slice by mesh
  name/tag, a placeholder for "unarmored beginner". No male/female choice, no
  character creation, no ritual clothing, no new rig/model/animation, no shamanic
  class system. If the priest model ever changes, the `Mage_Hat`/`Mage_Cape` name
  hide would need revisiting. The final look is a product/art decision after
  playtest.
- The presence position/scale were tuned by validation + a short technical preview,
  not a full human aesthetic pass; whether it reads well at the real camera is for
  the human playtest to judge.
- Touch is deliberately minimal and slice-specific (not the general mobile system):
  NO pinch zoom (camera distance is fixed on touch; wheel zoom stays on desktop),
  NO gamepad, no vibration, no forced fullscreen, no PWA install, no forced
  orientation lock. Portrait is only TOLERATED (landscape is prioritized; the
  controls lift clear of the message in portrait but the layout is tuned for
  landscape). The controls live in the slice only and never touch the global Input.
  E10 added the safety resets (blur / hidden tab / orientation) but no new gesture.
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
  gamepad, or settings. Interact is the keyboard `F` key or the E9 touch button.
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

## 13. Playtest readiness (after E11)
The playable prototype is consolidated and its two worst visual reads are fixed. A
REAL tablet playtest confirmed E9 (LAN open, joystick, drag camera, interact button,
landscape). E10 hardened touch + LAN. E11 addressed the two playtest visual notes:
the presence now sits in the open lake (reads unobstructed) and the Neofito is a
plain unarmed robe, not a knight. Verified at E11: check:ts clean, `npm run build`
green (generated artifacts restored), the focused test set green (69 across the
river suites; 13 presence-visual + the new neophyte suite), and a short technical
preview confirmed on the real model that the presence is central over the water,
the Neofito shows no hat/cape/weapon (only `Mage_Hat`/`Mage_Cape`/`staff_A` hidden),
`/` stays intact, and the console has no new slice errors. The slice is ready for a
human aesthetic playtest to judge the look and decide direction (section 14).

## 14. Next step: a product decision after the (now confirmed) playtest
The tablet playtest is done and the prototype is consolidated with its visuals
repositioned (E11), so the next step is a PRODUCT decision after a human aesthetic
playtest, not more plumbing. Choose ONE direction; do not start it speculatively:
- **Refine the river manifestation**: tune legibility/intensity/animation of the
  E8 presence (still no shader system, still the vertical slice).
- **Prototype a second kind of presence**: a tree, a stone, or an animal, to test
  whether the "inhabited place" pattern generalizes beyond the river.
- **Begin structuring the first journey, the mentor, and the starting point**: move
  from a single encounter toward a small authored arc with its first characters.
Fix only problems a playtest surfaces (small, targeted); one step per commit.

## 16. Package manager and local run commands (E10)
- **Canonical package manager: npm.** Evidence: `package-lock.json` is the only
  tracked lockfile, there is no `packageManager` field, every CI workflow installs
  with `npm ci`, and the README uses `npm install`. Do NOT use pnpm/yarn here.
- **Stray pnpm files** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`) from a local pnpm
  run were removed (untracked, never committed) and are now gitignored. The
  `pnpm-workspace.yaml` held only pnpm build-approvals (esbuild/sharp/electron
  -winstaller), a pnpm-only concern npm does not need. `package-lock.json` was left
  untouched; the existing `node_modules` builds and tests green under npm, so no
  reinstall was needed. If a clean canonical restore is ever wanted, run `npm ci`.
- **Install**: `npm ci` (CI / reproducible) or `npm install` (dev).
- **Local dev**: `npm run dev` (Vite on :5173).
- **LAN dev (tablet)**: `npm run dev:lan` (= `vite --host`). It serves directly,
  prints the `Network:` URL, runs no install/build/test, and modifies nothing.
- **URL**: on the tablet (same Wi-Fi), open `http://<LAN-IP>:<PORT>/river.html`
  (default port 5173; Vite auto-increments if it is taken, e.g. 5174). The touch
  controls appear automatically (coarse pointer / touch points); no flags.
- **Same network**: the computer and the tablet must be on the same LAN/Wi-Fi. On a
  private network the OS firewall may prompt to allow Node/Vite the first time;
  allow it. There is no server/login, so no backend is needed (the `/` landing's
  "project stats" fetch failing offline is expected and unrelated to the slice).
- **Orientation**: landscape is recommended; portrait is tolerated.

## 15. Questions the playtest must answer
- Did the player find the ford (the shallow southern neck)?
- Did they notice the river stones (token) and the ford stones?
- Did they understand where/how to interact (the offering)?
- Did they perceive that the river reacted to their conduct?
- Did they notice the E8 presence in the water, and did it change with the river's
  mood (curious vs turbulent vs open vs contained)?
- Did they describe the crossing as a relationship, or as a puzzle?
