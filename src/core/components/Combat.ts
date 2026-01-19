// ==========================================
// Combat 컴포넌트 - 전투 정보
// ==========================================

import { Component } from '../ecs/Component';
import type { EntityId } from '@shared/types';

export enum CombatState {
  IDLE = 'idle',
  ATTACKING = 'attacking',
  CHASING = 'chasing',
  ATTACK_MOVING = 'attack_moving',
}

export interface CombatData {
  state: CombatState;
  targetId: EntityId | null;
  attackCooldown: number;
  aggroRange: number;
  isHoldPosition: boolean;
  attackMoveTargetX: number | null;
  attackMoveTargetY: number | null;
}

export class Combat extends Component {
  static readonly type = 'combat';

  public state: CombatState = CombatState.IDLE;
  public targetId: EntityId | null = null;
  public attackCooldown: number = 0;
  public aggroRange: number; // 자동 공격 범위 (타일)
  public isHoldPosition: boolean = false;
  public attackMoveTargetX: number | null = null;
  public attackMoveTargetY: number | null = null;

  constructor(aggroRange: number = 7) {
    super();
    this.aggroRange = aggroRange;
  }

  setTarget(targetId: EntityId): void {
    this.targetId = targetId;
    this.state = CombatState.ATTACKING;
  }

  clearTarget(): void {
    this.targetId = null;
    // A-Move 중이면 ATTACK_MOVING 상태 유지, 아니면 IDLE로
    if (this.attackMoveTargetX !== null && this.attackMoveTargetY !== null) {
      this.state = CombatState.ATTACK_MOVING;
    } else {
      this.state = CombatState.IDLE;
    }
  }

  canAttack(): boolean {
    return this.attackCooldown <= 0;
  }

  startCooldown(cooldownTicks: number): void {
    this.attackCooldown = cooldownTicks;
  }

  reduceCooldown(amount: number = 1): void {
    this.attackCooldown = Math.max(0, this.attackCooldown - amount);
  }

  holdPosition(): void {
    this.isHoldPosition = true;
  }

  releaseHold(): void {
    this.isHoldPosition = false;
  }

  serialize(): CombatData {
    return {
      state: this.state,
      targetId: this.targetId,
      attackCooldown: this.attackCooldown,
      aggroRange: this.aggroRange,
      isHoldPosition: this.isHoldPosition,
      attackMoveTargetX: this.attackMoveTargetX,
      attackMoveTargetY: this.attackMoveTargetY,
    };
  }

  deserialize(data: unknown): void {
    const d = data as CombatData;
    this.state = d.state;
    this.targetId = d.targetId;
    this.attackCooldown = d.attackCooldown;
    this.aggroRange = d.aggroRange;
    this.isHoldPosition = d.isHoldPosition;
    this.attackMoveTargetX = d.attackMoveTargetX;
    this.attackMoveTargetY = d.attackMoveTargetY;
  }

  clone(): Combat {
    const c = new Combat(this.aggroRange);
    c.state = this.state;
    c.targetId = this.targetId;
    c.attackCooldown = this.attackCooldown;
    c.isHoldPosition = this.isHoldPosition;
    c.attackMoveTargetX = this.attackMoveTargetX;
    c.attackMoveTargetY = this.attackMoveTargetY;
    return c;
  }

  // A-Move 시작
  startAttackMove(targetX: number, targetY: number): void {
    this.state = CombatState.ATTACK_MOVING;
    this.attackMoveTargetX = targetX;
    this.attackMoveTargetY = targetY;
    this.targetId = null;
    this.isHoldPosition = false;
  }

  // A-Move 목표 도달 확인
  hasReachedAttackMoveTarget(currentX: number, currentY: number, threshold: number = 32): boolean {
    if (this.attackMoveTargetX === null || this.attackMoveTargetY === null) return true;
    const dx = this.attackMoveTargetX - currentX;
    const dy = this.attackMoveTargetY - currentY;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  }

  // A-Move 종료
  stopAttackMove(): void {
    this.attackMoveTargetX = null;
    this.attackMoveTargetY = null;
    if (this.state === CombatState.ATTACK_MOVING) {
      this.state = CombatState.IDLE;
    }
  }
}
