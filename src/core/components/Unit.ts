// ==========================================
// Unit 컴포넌트 - 유닛 정보
// ==========================================

import { Component } from '../ecs/Component';
import { UnitType } from '@shared/types';
import { UNIT_STATS } from '@shared/constants';

export interface UnitData {
  unitType: UnitType;
  hp: number;
  maxHp: number;
  armor: number;
  damage: number;
  attackSpeed: number;
  range: number;
  isSieged?: boolean;
  isStimmed?: boolean;
  stimTimer?: number;
}

export class Unit extends Component {
  static readonly type = 'unit';

  public unitType: UnitType;
  public hp: number;
  public maxHp: number;
  public armor: number;
  public damage: number;
  public attackSpeed: number;
  public range: number;
  
  // Siege Tank specific
  public isSieged: boolean = false;
  public baseDamage: number;
  public baseRange: number;
  
  // Stim Pack specific
  public isStimmed: boolean = false;
  public stimTimer: number = 0;
  public baseAttackSpeed: number;
  public baseMoveSpeed: number;

  constructor(unitType: UnitType) {
    super();
    this.unitType = unitType;

    // 스탯 초기화
    const stats = UNIT_STATS[unitType];
    this.hp = stats.hp;
    this.maxHp = stats.hp;
    this.armor = stats.armor;
    this.damage = stats.damage;
    this.attackSpeed = stats.attackSpeed;
    this.range = stats.range;
    
    // Base values for modifications
    this.baseDamage = stats.damage;
    this.baseRange = stats.range;
    this.baseAttackSpeed = stats.attackSpeed;
    this.baseMoveSpeed = stats.moveSpeed;
  }
  
  // Siege Tank siege mode toggle
  toggleSiege(): void {
    const stats = UNIT_STATS[this.unitType];
    if (!stats.canSiege) return;
    
    this.isSieged = !this.isSieged;
    if (this.isSieged) {
      this.damage = stats.siegeDamage || this.baseDamage;
      this.range = stats.siegeRange || this.baseRange;
    } else {
      this.damage = this.baseDamage;
      this.range = this.baseRange;
    }
  }
  
  // Stim Pack activation
  activateStim(): boolean {
    if (this.isStimmed) return false;
    if (this.hp <= 10) return false; // Not enough HP
    
    this.isStimmed = true;
    this.stimTimer = 160; // ~10 seconds at 16 ticks/sec
    this.hp -= 10; // Costs 10 HP
    this.attackSpeed = this.baseAttackSpeed * 0.5; // 50% faster
    return true;
  }
  
  // Update stim timer
  updateStim(): void {
    if (!this.isStimmed) return;
    
    this.stimTimer--;
    if (this.stimTimer <= 0) {
      this.isStimmed = false;
      this.attackSpeed = this.baseAttackSpeed;
    }
  }

  takeDamage(amount: number): number {
    const actualDamage = Math.max(0, amount - this.armor);
    this.hp = Math.max(0, this.hp - actualDamage);
    return actualDamage;
  }

  heal(amount: number): void {
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  isDead(): boolean {
    return this.hp <= 0;
  }

  getHpPercent(): number {
    return this.hp / this.maxHp;
  }

  serialize(): UnitData {
    return {
      unitType: this.unitType,
      hp: this.hp,
      maxHp: this.maxHp,
      armor: this.armor,
      damage: this.damage,
      attackSpeed: this.attackSpeed,
      range: this.range,
      isSieged: this.isSieged,
      isStimmed: this.isStimmed,
      stimTimer: this.stimTimer,
    };
  }

  deserialize(data: unknown): void {
    const d = data as UnitData;
    this.unitType = d.unitType;
    this.hp = d.hp;
    this.maxHp = d.maxHp;
    this.armor = d.armor;
    this.damage = d.damage;
    this.attackSpeed = d.attackSpeed;
    this.range = d.range;
    this.isSieged = d.isSieged || false;
    this.isStimmed = d.isStimmed || false;
    this.stimTimer = d.stimTimer || 0;
  }

  clone(): Unit {
    const u = new Unit(this.unitType);
    u.hp = this.hp;
    u.maxHp = this.maxHp;
    u.armor = this.armor;
    u.damage = this.damage;
    u.attackSpeed = this.attackSpeed;
    u.range = this.range;
    u.isSieged = this.isSieged;
    u.isStimmed = this.isStimmed;
    u.stimTimer = this.stimTimer;
    return u;
  }
}
