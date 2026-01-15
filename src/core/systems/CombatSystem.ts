// ==========================================
// CombatSystem - 전투 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Position } from '../components/Position';
import { Owner } from '../components/Owner';
import { Unit } from '../components/Unit';
import { Movement } from '../components/Movement';
import { Combat, CombatState } from '../components/Combat';
import { Building } from '../components/Building';

export class CombatSystem extends System {
  readonly requiredComponents = [Position.type, Combat.type, Unit.type, Owner.type];
  readonly priority = 40;

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position)!;
      const combat = entity.getComponent<Combat>(Combat)!;
      const unit = entity.getComponent<Unit>(Unit)!;
      const owner = entity.getComponent<Owner>(Owner)!;
      const movement = entity.getComponent<Movement>(Movement);

      // 쿨다운 감소
      combat.reduceCooldown(1);

      // 타겟이 있으면 공격 처리
      if (combat.targetId !== null) {
        this.handleCombat(entity, position, combat, unit, owner, movement, gameState);
      } else if (combat.state === CombatState.ATTACK_MOVING) {
        // A-Move: 이동하면서 적 탐색
        this.handleAttackMove(entity, position, combat, owner, movement, gameState);
      } else {
        // 자동 타겟 찾기 (어그로 범위 내)
        this.findAutoTarget(entity, position, combat, owner, gameState);
      }
    }
  }

  private handleCombat(
    entity: Entity,
    position: Position,
    combat: Combat,
    unit: Unit,
    owner: Owner,
    movement: Movement | undefined,
    gameState: GameState
  ): void {
    const target = gameState.getEntity(combat.targetId!);
    
    if (!target) {
      combat.clearTarget();
      return;
    }

    const targetPos = target.getComponent<Position>(Position);
    const targetUnit = target.getComponent<Unit>(Unit);
    const targetBuilding = target.getComponent<Building>(Building);
    const targetOwner = target.getComponent<Owner>(Owner);

    if (!targetPos || !targetOwner || targetOwner.playerId === owner.playerId) {
      combat.clearTarget();
      return;
    }

    // 타겟이 죽었는지 체크
    if (targetUnit?.isDead() || targetBuilding?.isDestroyed()) {
      combat.clearTarget();
      return;
    }

    const distance = position.distanceTo(targetPos);
    const range = unit.range * 32; // 타일 → 픽셀

    if (distance <= range) {
      // 사정거리 내 - 공격
      combat.state = CombatState.ATTACKING;
      movement?.stop();

      if (combat.canAttack()) {
        this.attack(entity, unit, target, position, targetPos, gameState);
        combat.startCooldown(Math.floor(16 / unit.attackSpeed)); // 틱 기반 쿨다운
      }
    } else if (!combat.isHoldPosition) {
      // 추격
      combat.state = CombatState.CHASING;
      movement?.setTarget(targetPos.x, targetPos.y);
    }
  }

  private attack(
    attackerEntity: Entity,
    attacker: Unit, 
    target: Entity, 
    attackerPos: Position, 
    targetPos: Position, 
    gameState: GameState
  ): void {
    const attackerStats = UNIT_STATS[attacker.unitType];

    // 프로젝타일 타입 결정
    let projectileType: ProjectileType = 'bullet';
    if (attacker.unitType === UnitType.FIREBAT) {
      projectileType = 'flame';
    } else if (attacker.unitType === UnitType.SIEGE_TANK || attacker.unitType === UnitType.GOLIATH) {
      projectileType = 'missile';
    }

    // 공격 이벤트 발송 (이펙트용)
    combatEvents.emitAttack({
      attackerX: attackerPos.x,
      attackerY: attackerPos.y,
      targetX: targetPos.x,
      targetY: targetPos.y,
      projectileType,
      damage: attacker.damage,
    });

    // 스플래시 데미지 체크
    const hasSplash = attackerStats.splashDamage && attackerStats.splashRadius;
    const splashRadiusPx = (attackerStats.splashRadius || 0) * 32;

    if (hasSplash) {
      // 스플래시 데미지: 타겟 주변 모든 적에게 데미지
      this.applySplashDamage(attackerEntity, attacker, targetPos, splashRadiusPx, gameState);
    } else {
      // 단일 타겟 데미지
      this.applyDamageToEntity(attacker.damage, target, targetPos, gameState);
    }
  }

  // 스플래시 데미지 적용
  private applySplashDamage(
    attackerEntity: Entity,
    attacker: Unit,
    impactPos: Position,
    splashRadius: number,
    gameState: GameState
  ): void {
    // 공격자 소속 기준으로 적 판단 (타겟 기준 X)
    const attackerOwner = attackerEntity.getComponent<Owner>(Owner);
    const attackerPlayerId = attackerOwner?.playerId;

    // 스플래시 범위 내 모든 적 엔티티 찾기
    for (const entity of gameState.getAllEntities()) {
      if (entity.isDestroyed()) continue;

      const owner = entity.getComponent<Owner>(Owner);
      const pos = entity.getComponent<Position>(Position);
      const unit = entity.getComponent<Unit>(Unit);
      const building = entity.getComponent<Building>(Building);

      if (!owner || !pos || (!unit && !building)) continue;
      
      // 같은 팀은 스킵 (적만 타격)
      if (owner.playerId === attackerPlayerId) continue;

      const distance = impactPos.distanceTo(pos);
      
      if (distance <= splashRadius) {
        // 거리에 따른 데미지 감소 (중심: 100%, 가장자리: 50%)
        const damageFalloff = 1 - (distance / splashRadius) * 0.5;
        const splashDamage = Math.floor(attacker.damage * damageFalloff);
        
        this.applyDamageToEntity(splashDamage, entity, pos, gameState);
      }
    }
  }

  // 단일 엔티티에 데미지 적용
  private applyDamageToEntity(
    damage: number,
    target: Entity,
    targetPos: Position,
    gameState: GameState
  ): void {
    const targetUnit = target.getComponent<Unit>(Unit);
    const targetBuilding = target.getComponent<Building>(Building);

    if (targetUnit) {
      const actualDamage = targetUnit.takeDamage(damage);

      // 히트 이벤트 (스파크 효과용)
      combatEvents.emitHit({
        x: targetPos.x,
        y: targetPos.y,
        damage: actualDamage,
        isBuilding: false,
      });

      if (targetUnit.isDead()) {
        // 죽음 이벤트 발송 (유닛 크기는 카테고리 기반)
        const size = targetUnit.unitType === UnitType.SIEGE_TANK ? 16 
          : targetUnit.unitType === UnitType.GOLIATH ? 14 
          : targetUnit.unitType === UnitType.VULTURE ? 14 
          : 10;
        combatEvents.emitDeath({
          x: targetPos.x,
          y: targetPos.y,
          size,
          isBuilding: false,
        });
        
        // 유닛 사망시 Supply 반환
        const targetOwner = target.getComponent<Owner>(Owner);
        if (targetOwner) {
          const unitStats = UNIT_STATS[targetUnit.unitType];
          gameState.modifyPlayerResources(targetOwner.playerId, {
            supply: -unitStats.supplyCost,
          });
        }
        
        target.destroy();
      }
    } else if (targetBuilding) {
      const actualDamage = targetBuilding.takeDamage(damage);

      // 히트 이벤트 (스파크 효과용)
      combatEvents.emitHit({
        x: targetPos.x,
        y: targetPos.y,
        damage: actualDamage,
        isBuilding: true,
      });

      if (targetBuilding.isDestroyed()) {
        // 건물 파괴 이벤트 발송
        combatEvents.emitDeath({
          x: targetPos.x,
          y: targetPos.y,
          size: Math.max(targetBuilding.width, targetBuilding.height) * 32,
          isBuilding: true,
        });
        target.destroy();
        
        // 건물 파괴시 공급량 감소 체크
        const targetOwner = target.getComponent<Owner>(Owner);
        if (targetOwner) {
          const stats = BUILDING_STATS[targetBuilding.buildingType];
          if (stats.supplyProvided > 0) {
            gameState.modifyPlayerResources(targetOwner.playerId, {
              supplyMax: -stats.supplyProvided,
            });
          }
        }
      }
    }
  }

  private findAutoTarget(
    _entity: Entity,
    position: Position,
    combat: Combat,
    owner: Owner,
    gameState: GameState
  ): void {
    const aggroRangePx = combat.aggroRange * 32;
    let nearestEnemy: Entity | null = null;
    let nearestDist = Infinity;

    for (const other of gameState.getAllEntities()) {
      if (other.isDestroyed()) continue;
      
      const otherOwner = other.getComponent<Owner>(Owner);
      if (!otherOwner || otherOwner.playerId === owner.playerId) continue;

      const otherPos = other.getComponent<Position>(Position);
      if (!otherPos) continue;

      const otherUnit = other.getComponent<Unit>(Unit);
      const otherBuilding = other.getComponent<Building>(Building);
      if (!otherUnit && !otherBuilding) continue;

      const dist = position.distanceTo(otherPos);
      if (dist <= aggroRangePx && dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = other;
      }
    }

    if (nearestEnemy) {
      combat.setTarget(nearestEnemy.id);
    }
  }

  // A-Move 처리
  private handleAttackMove(
    _entity: Entity,
    position: Position,
    combat: Combat,
    owner: Owner,
    movement: Movement | undefined,
    gameState: GameState
  ): void {
    // 목표 지점 도달 확인
    if (combat.hasReachedAttackMoveTarget(position.x, position.y)) {
      combat.stopAttackMove();
      movement?.stop();
      return;
    }

    // 이동 중 적 탐색 (어그로 범위)
    const aggroRangePx = combat.aggroRange * 32;
    let nearestEnemy: Entity | null = null;
    let nearestDist = Infinity;

    for (const other of gameState.getAllEntities()) {
      if (other.isDestroyed()) continue;
      
      const otherOwner = other.getComponent<Owner>(Owner);
      if (!otherOwner || otherOwner.playerId === owner.playerId) continue;

      const otherPos = other.getComponent<Position>(Position);
      if (!otherPos) continue;

      const otherUnit = other.getComponent<Unit>(Unit);
      const otherBuilding = other.getComponent<Building>(Building);
      if (!otherUnit && !otherBuilding) continue;

      const dist = position.distanceTo(otherPos);
      if (dist <= aggroRangePx && dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = other;
      }
    }

    // 적 발견시 공격 (A-Move 상태 유지)
    if (nearestEnemy) {
      combat.setTarget(nearestEnemy.id);
      // state는 ATTACKING이 되지만 attackMoveTarget은 유지
    } else if (movement && !movement.isMoving) {
      // 적이 없고 이동 중이 아니면 목표로 계속 이동
      if (combat.attackMoveTargetX !== null && combat.attackMoveTargetY !== null) {
        movement.setTarget(combat.attackMoveTargetX, combat.attackMoveTargetY);
      }
    }
  }
}

// Import for building stats and events
import { BUILDING_STATS, UNIT_STATS } from '@shared/constants';
import { combatEvents, type ProjectileType } from '../events/CombatEvents';
import { UnitType } from '@shared/types';
