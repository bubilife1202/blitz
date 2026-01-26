import { describe, it, expect } from 'vitest';
import {
  secondsToTicks,
  ticksToSeconds,
  perSecondToPerTick,
  perTickToPerSecond,
  TICK_RATE,
  canBuildBuilding,
  canTrainUnit,
  canResearchUpgrade,
  UNIT_STATS,
  BUILDING_STATS,
} from '../src/shared/constants';
import { BuildingType, UnitType, UpgradeType } from '../src/shared/types';

describe('Time Conversion Functions', () => {
  it('should convert seconds to ticks', () => {
    expect(secondsToTicks(1)).toBe(TICK_RATE);
    expect(secondsToTicks(2)).toBe(TICK_RATE * 2);
    expect(secondsToTicks(0.5)).toBe(Math.round(TICK_RATE * 0.5));
  });

  it('should convert ticks to seconds', () => {
    expect(ticksToSeconds(TICK_RATE)).toBe(1);
    expect(ticksToSeconds(TICK_RATE * 2)).toBe(2);
  });

  it('should be reversible', () => {
    const original = 5;
    const ticks = secondsToTicks(original);
    const back = ticksToSeconds(ticks);
    
    expect(back).toBeCloseTo(original, 1);
  });

  it('should convert per-second to per-tick rates', () => {
    const dps = 16;
    const dpt = perSecondToPerTick(dps);
    
    expect(dpt).toBe(1);
  });

  it('should convert per-tick to per-second rates', () => {
    const dpt = 1;
    const dps = perTickToPerSecond(dpt);
    
    expect(dps).toBe(TICK_RATE);
  });
});

describe('Tech Tree Validation', () => {
  describe('canBuildBuilding', () => {
    it('should allow Command Center without requirements', () => {
      expect(canBuildBuilding(BuildingType.COMMAND_CENTER, [])).toBe(true);
    });

    it('should require Barracks for Factory', () => {
      expect(canBuildBuilding(BuildingType.FACTORY, [])).toBe(false);
      expect(canBuildBuilding(BuildingType.FACTORY, [BuildingType.BARRACKS])).toBe(true);
    });

    it('should require Factory for Armory', () => {
      expect(canBuildBuilding(BuildingType.ARMORY, [])).toBe(false);
      expect(canBuildBuilding(BuildingType.ARMORY, [BuildingType.FACTORY])).toBe(true);
    });
  });

  describe('canTrainUnit', () => {
    it('should allow Marine without requirements', () => {
      expect(canTrainUnit(UnitType.MARINE, [])).toBe(true);
    });

    it('should require Engineering Bay for Firebat', () => {
      expect(canTrainUnit(UnitType.FIREBAT, [])).toBe(false);
      expect(canTrainUnit(UnitType.FIREBAT, [BuildingType.ENGINEERING_BAY])).toBe(true);
    });

    it('should require Armory for Siege Tank', () => {
      expect(canTrainUnit(UnitType.SIEGE_TANK, [])).toBe(false);
      expect(canTrainUnit(UnitType.SIEGE_TANK, [BuildingType.ARMORY])).toBe(true);
    });
  });

  describe('canResearchUpgrade', () => {
    it('should allow level 1 upgrades without requirements', () => {
      expect(canResearchUpgrade(UpgradeType.INFANTRY_WEAPONS_1, [])).toBe(true);
    });

    it('should require level 1 for level 2 upgrades', () => {
      expect(canResearchUpgrade(UpgradeType.INFANTRY_WEAPONS_2, [])).toBe(false);
      expect(canResearchUpgrade(UpgradeType.INFANTRY_WEAPONS_2, [UpgradeType.INFANTRY_WEAPONS_1])).toBe(true);
    });

    it('should require level 2 for level 3 upgrades', () => {
      expect(canResearchUpgrade(UpgradeType.INFANTRY_WEAPONS_3, [UpgradeType.INFANTRY_WEAPONS_1])).toBe(false);
      expect(canResearchUpgrade(UpgradeType.INFANTRY_WEAPONS_3, [
        UpgradeType.INFANTRY_WEAPONS_1,
        UpgradeType.INFANTRY_WEAPONS_2,
      ])).toBe(true);
    });
  });
});

describe('Unit Stats Integrity', () => {
  it('should have positive HP for all units', () => {
    for (const [type, stats] of Object.entries(UNIT_STATS)) {
      expect(stats.hp, `${type} should have positive HP`).toBeGreaterThan(0);
    }
  });

  it('should have valid build times', () => {
    for (const [type, stats] of Object.entries(UNIT_STATS)) {
      expect(stats.buildTime, `${type} should have positive buildTime`).toBeGreaterThan(0);
    }
  });

  it('should have valid vision ranges', () => {
    for (const [type, stats] of Object.entries(UNIT_STATS)) {
      expect(stats.visionRange, `${type} should have positive visionRange`).toBeGreaterThan(0);
    }
  });
});

describe('Building Stats Integrity', () => {
  it('should have positive HP for all buildings', () => {
    for (const [type, stats] of Object.entries(BUILDING_STATS)) {
      expect(stats.hp, `${type} should have positive HP`).toBeGreaterThan(0);
    }
  });

  it('should have valid sizes', () => {
    for (const [type, stats] of Object.entries(BUILDING_STATS)) {
      expect(stats.size.width, `${type} width`).toBeGreaterThan(0);
      expect(stats.size.height, `${type} height`).toBeGreaterThan(0);
    }
  });
});
