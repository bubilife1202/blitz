import { describe, it, expect, beforeEach } from 'vitest';
import { Unit } from '../src/core/components/Unit';
import { UnitType } from '../src/shared/types';

describe('Unit Component', () => {
  describe('Marine', () => {
    let marine: Unit;

    beforeEach(() => {
      marine = new Unit(UnitType.MARINE);
    });

    it('should initialize with correct stats', () => {
      expect(marine.unitType).toBe(UnitType.MARINE);
      expect(marine.maxHp).toBe(40);
      expect(marine.hp).toBe(40);
      expect(marine.damage).toBe(6);
      expect(marine.range).toBe(4);
    });

    it('should take damage reduced by armor', () => {
      const initialHp = marine.hp;
      const actualDamage = marine.takeDamage(10);
      
      expect(actualDamage).toBe(10 - marine.armor);
      expect(marine.hp).toBe(initialHp - actualDamage);
    });

    it('should not go below 0 HP', () => {
      marine.takeDamage(1000);
      
      expect(marine.hp).toBe(0);
      expect(marine.isDead()).toBe(true);
    });

    it('should heal up to max HP', () => {
      marine.takeDamage(20);
      marine.heal(100);
      
      expect(marine.hp).toBe(marine.maxHp);
    });

    it('should calculate HP percentage', () => {
      marine.takeDamage(20);
      
      expect(marine.getHpPercent()).toBe(0.5);
    });
  });

  describe('Stim Pack', () => {
    let marine: Unit;

    beforeEach(() => {
      marine = new Unit(UnitType.MARINE);
    });

    it('should activate stim', () => {
      const result = marine.activateStim();
      
      expect(result).toBe(true);
      expect(marine.isStimmed).toBe(true);
      expect(marine.hp).toBe(30); // -10 HP cost
      expect(marine.attackSpeed).toBe(marine.baseAttackSpeed * 0.5);
    });

    it('should not activate stim if already stimmed', () => {
      marine.activateStim();
      const result = marine.activateStim();
      
      expect(result).toBe(false);
    });

    it('should not activate stim with low HP', () => {
      marine.takeDamage(35); // HP = 5
      const result = marine.activateStim();
      
      expect(result).toBe(false);
      expect(marine.isStimmed).toBe(false);
    });

    it('should expire stim after timer', () => {
      marine.activateStim();
      
      for (let i = 0; i < 200; i++) {
        marine.updateStim();
      }
      
      expect(marine.isStimmed).toBe(false);
      expect(marine.attackSpeed).toBe(marine.baseAttackSpeed);
    });
  });

  describe('Siege Tank', () => {
    let tank: Unit;

    beforeEach(() => {
      tank = new Unit(UnitType.SIEGE_TANK);
    });

    it('should toggle siege mode', () => {
      const normalDamage = tank.damage;
      const normalRange = tank.range;
      
      tank.toggleSiege();
      
      expect(tank.isSieged).toBe(true);
      expect(tank.damage).toBeGreaterThan(normalDamage);
      expect(tank.range).toBeGreaterThan(normalRange);
      
      tank.toggleSiege();
      
      expect(tank.isSieged).toBe(false);
      expect(tank.damage).toBe(normalDamage);
      expect(tank.range).toBe(normalRange);
    });
  });

  describe('Serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const original = new Unit(UnitType.MARINE);
      original.takeDamage(10);
      original.activateStim();
      
      const data = original.serialize();
      const restored = new Unit(UnitType.MARINE);
      restored.deserialize(data);
      
      expect(restored.hp).toBe(original.hp);
      expect(restored.isStimmed).toBe(original.isStimmed);
      expect(restored.attackSpeed).toBe(original.attackSpeed);
    });
  });
});
