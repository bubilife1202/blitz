// ==========================================
// CombatEvents - 전투 이벤트 버스
// ==========================================

export type ProjectileType = 'bullet' | 'missile' | 'flame' | 'heal';
export type ExplosionType = 'small' | 'medium' | 'large' | 'heal';

export interface AttackEvent {
  attackerX: number;
  attackerY: number;
  targetX: number;
  targetY: number;
  projectileType: ProjectileType;
  damage: number;
}

export interface DeathEvent {
  x: number;
  y: number;
  size: number;
  isBuilding: boolean;
}

export interface HealEvent {
  healerX: number;
  healerY: number;
  targetX: number;
  targetY: number;
}

export interface HitEvent {
  x: number;
  y: number;
  damage: number;
  isBuilding: boolean;
}

type AttackListener = (event: AttackEvent) => void;
type DeathListener = (event: DeathEvent) => void;
type HealListener = (event: HealEvent) => void;
type HitListener = (event: HitEvent) => void;

class CombatEventBus {
  private attackListeners: AttackListener[] = [];
  private deathListeners: DeathListener[] = [];
  private healListeners: HealListener[] = [];
  private hitListeners: HitListener[] = [];

  onAttack(listener: AttackListener): void {
    this.attackListeners.push(listener);
  }

  offAttack(listener: AttackListener): void {
    const idx = this.attackListeners.indexOf(listener);
    if (idx !== -1) this.attackListeners.splice(idx, 1);
  }

  onDeath(listener: DeathListener): void {
    this.deathListeners.push(listener);
  }

  offDeath(listener: DeathListener): void {
    const idx = this.deathListeners.indexOf(listener);
    if (idx !== -1) this.deathListeners.splice(idx, 1);
  }

  onHeal(listener: HealListener): void {
    this.healListeners.push(listener);
  }

  offHeal(listener: HealListener): void {
    const idx = this.healListeners.indexOf(listener);
    if (idx !== -1) this.healListeners.splice(idx, 1);
  }

  onHit(listener: HitListener): void {
    this.hitListeners.push(listener);
  }

  offHit(listener: HitListener): void {
    const idx = this.hitListeners.indexOf(listener);
    if (idx !== -1) this.hitListeners.splice(idx, 1);
  }

  emitAttack(event: AttackEvent): void {
    for (const listener of this.attackListeners) {
      listener(event);
    }
  }

  emitDeath(event: DeathEvent): void {
    for (const listener of this.deathListeners) {
      listener(event);
    }
  }

  emitHeal(event: HealEvent): void {
    for (const listener of this.healListeners) {
      listener(event);
    }
  }

  emitHit(event: HitEvent): void {
    for (const listener of this.hitListeners) {
      listener(event);
    }
  }

  clear(): void {
    this.attackListeners = [];
    this.deathListeners = [];
    this.healListeners = [];
    this.hitListeners = [];
  }
}

// 싱글턴 인스턴스
export const combatEvents = new CombatEventBus();
