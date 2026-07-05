// Vertical slice "O Rio": the Neofito's neutral appearance (E11).
//
// The playtest flagged that the starting character still looked like a warrior
// (plate + helmet + cape + sword), which contradicts a beginning meant to read as
// simple and vulnerable. This module holds the two slice-local decisions that
// neutralize that look, kept out of river_main.ts so they stay DOM/THREE-free and
// unit-testable:
//   1. the neutral placeholder CLASS the slice spawns (an EXISTING robed class, no
//      heavy armor, no pet, no form) instead of 'warrior';
//   2. a pure predicate that recognizes an attached held-weapon mesh, so the slice
//      entry can hide the weapon in its own scene without touching the global
//      equipment system or the original game.
//
// This is NOT the definitive skin: the Neofito's real identity is future work.
import type { PlayerClass } from './sim/types';

// The slice spawns the priest class purely for its APPEARANCE: it renders the
// mage.glb robe with no cape and no helmet (VisualDef player_priest uses show:[])
// and a pale tint, so the figure reads as a plain-robed, unarmored beginner rather
// than a knight. It is an existing class with no pet and no form (like the previous
// 'warrior' placeholder), so the slice bootstrap needs no special setup. This is a
// technical placeholder for the look only, not a class or design decision.
export const RIVER_NEOPHYTE_CLASS: PlayerClass = 'priest';

// A held weapon is attached to the character model, and every mesh of the
// attachment is tagged `userData.weaponMesh === true` by the renderer's attach path
// (src/render/characters/assets.ts). The slice hides those meshes in its OWN scene
// so the Neofito carries no visible weapon (no sword, no staff). This only READS the
// tag; it never removes weapons from the game and never touches equipment.
export function isHeldWeaponObject(o: { userData?: { weaponMesh?: unknown } }): boolean {
  return o.userData?.weaponMesh === true;
}

// The priest reuses mage.glb, whose Hat and Cape are SKINNED meshes: VisualDef
// `show:[]` only filters NON-skinned accessory nodes, so those two stay on (the wide
// hat brim even hides the whole body from the chase camera). To keep the Neofito a
// plain-robed, bare-headed beginner we also hide these two meshes by name in the
// slice's own scene. Slice-local presentation only; the model/renderer are untouched.
const NEOPHYTE_HIDDEN_MESH_NAMES: readonly string[] = ['Mage_Hat', 'Mage_Cape'];

// True for anything the slice hides on the Neofito: the held weapon (any class) and
// the mage-robe hat/cape. Pure read; never mutates.
export function isNeophyteHiddenObject(o: {
  name?: unknown;
  userData?: { weaponMesh?: unknown };
}): boolean {
  if (isHeldWeaponObject(o)) return true;
  return typeof o.name === 'string' && NEOPHYTE_HIDDEN_MESH_NAMES.includes(o.name);
}
