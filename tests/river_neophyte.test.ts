// E11 guard for the slice's neutral Neofito appearance (src/river_neophyte.ts).
// Pure, presentation-only decisions: which EXISTING class the slice spawns for a
// neutral (robed, unarmored) look, and the predicate that lets the slice entry hide
// the held weapon in its own scene. No sim behavior, no global equipment change.
import { describe, expect, it } from 'vitest';
import {
  isHeldWeaponObject,
  isNeophyteHiddenObject,
  RIVER_NEOPHYTE_CLASS,
} from '../src/river_neophyte';

// The nine existing player classes (src/sim/types.ts PlayerClass). The slice must
// REUSE one of these, never invent a new (e.g. shamanic) class.
const EXISTING_CLASSES = [
  'warrior',
  'paladin',
  'hunter',
  'rogue',
  'priest',
  'shaman',
  'mage',
  'warlock',
  'druid',
] as const;

describe('RIVER_NEOPHYTE_CLASS (neutral appearance)', () => {
  it('reuses an existing class (no new class invented)', () => {
    expect(EXISTING_CLASSES).toContain(RIVER_NEOPHYTE_CLASS);
  });

  it('is not the martial warrior placeholder any more', () => {
    expect(RIVER_NEOPHYTE_CLASS).not.toBe('warrior');
  });

  it('is the robed priest (mage.glb robe, no cape/helmet, no pet/form)', () => {
    // Pins the chosen neutral look so a later change is a deliberate one.
    expect(RIVER_NEOPHYTE_CLASS).toBe('priest');
  });
});

describe('isHeldWeaponObject (the Neofito carries no visible weapon)', () => {
  it('matches a tagged held-weapon mesh', () => {
    expect(isHeldWeaponObject({ userData: { weaponMesh: true } })).toBe(true);
  });

  it('does not match a body mesh or an untagged object', () => {
    expect(isHeldWeaponObject({ userData: {} })).toBe(false);
    expect(isHeldWeaponObject({})).toBe(false);
    expect(isHeldWeaponObject({ userData: { weaponMesh: false } })).toBe(false);
  });

  it('only reads the tag (never mutates the object)', () => {
    const o = { userData: { weaponMesh: true } };
    const snapshot = JSON.stringify(o);
    isHeldWeaponObject(o);
    expect(JSON.stringify(o)).toBe(snapshot);
  });
});

describe('isNeophyteHiddenObject (weapon + mage-robe hat/cape)', () => {
  it('hides the held weapon', () => {
    expect(isNeophyteHiddenObject({ userData: { weaponMesh: true } })).toBe(true);
  });

  it('hides the skinned mage hat and cape (which show:[] cannot remove)', () => {
    expect(isNeophyteHiddenObject({ name: 'Mage_Hat' })).toBe(true);
    expect(isNeophyteHiddenObject({ name: 'Mage_Cape' })).toBe(true);
  });

  it('keeps the robe body, head, and limbs visible', () => {
    for (const name of ['Mage_Body', 'Mage_Head', 'Mage_ArmLeft', 'Mage_LegRight']) {
      expect(isNeophyteHiddenObject({ name })).toBe(false);
    }
    expect(isNeophyteHiddenObject({})).toBe(false);
  });
});
