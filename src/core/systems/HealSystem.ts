// ==========================================
// HealSystem - 힐러 유닛 (메딕) 자동 치료 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Position } from '../components/Position';
import { Owner } from '../components/Owner';
import { Unit } from '../components/Unit';
import { Movement } from '../components/Movement';
import { UnitType, UnitCategory } from '@shared/types';
import { UNIT_STATS } from '@shared/constants';
import { combatEvents } from '../events/CombatEvents';

export class HealSystem extends System {
  readonly requiredComponents = [Position.type, Unit.type, Owner.type];
  readonly priority = 35; // Combat 전에 실행

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    // 메딕 찾기
    const medics = entities.filter(e => {
      const unit = e.getComponent<Unit>(Unit);
      return unit?.unitType === UnitType.MEDIC && !unit.isDead();
    });

    for (const medic of medics) {
      this.processMedic(medic, entities, gameState);
    }
    
    // Stim 타이머 업데이트 (모든 유닛)
    for (const entity of entities) {
      const unit = entity.getComponent<Unit>(Unit);
      if (unit?.isStimmed) {
        unit.updateStim();
      }
    }
  }

  private processMedic(medic: Entity, allEntities: Entity[], _gameState: GameState): void {
    const medicPos = medic.getComponent<Position>(Position)!;
    const medicOwner = medic.getComponent<Owner>(Owner)!;
    const medicMovement = medic.getComponent<Movement>(Movement);
    const stats = UNIT_STATS[UnitType.MEDIC];

    // 치료할 아군 찾기
    let bestTarget: Entity | null = null;
    let bestPriority = -Infinity;

    for (const entity of allEntities) {
      if (entity.id === medic.id) continue;

      const owner = entity.getComponent<Owner>(Owner);
      const unit = entity.getComponent<Unit>(Unit);
      const pos = entity.getComponent<Position>(Position);

      if (!owner || !unit || !pos) continue;
      if (owner.playerId !== medicOwner.playerId) continue;
      if (unit.isDead()) continue;
      if (unit.unitType === UnitType.MEDIC) continue; // 메딕끼리는 치료 안함
      
      // 보병만 치료 가능
      const unitStats = UNIT_STATS[unit.unitType];
      if (unitStats.category !== UnitCategory.INFANTRY && unitStats.category !== UnitCategory.WORKER) {
        continue;
      }

      const distance = medicPos.distanceTo(pos);
      
      // 체력 비율이 낮을수록 우선순위 높음
      const hpRatio = unit.hp / unit.maxHp;
      if (hpRatio >= 1) continue; // 풀피는 스킵
      
      // 우선순위 계산: HP 비율이 낮을수록, 거리가 가까울수록 높음
      const priority = (1 - hpRatio) * 100 - distance * 0.1;
      
      if (priority > bestPriority) {
        bestPriority = priority;
        bestTarget = entity;
      }
    }

    if (!bestTarget) return;

    const targetPos = bestTarget.getComponent<Position>(Position)!;
    const targetUnit = bestTarget.getComponent<Unit>(Unit)!;
    const distance = medicPos.distanceTo(targetPos);
    const effectiveHealRange = stats.range * 32;

    if (distance <= effectiveHealRange) {
      // 치료
      const healAmount = stats.healRate || 5;
      targetUnit.heal(healAmount);
      
      // 치유 이펙트 이벤트
      combatEvents.emitHeal({
        healerX: medicPos.x,
        healerY: medicPos.y,
        targetX: targetPos.x,
        targetY: targetPos.y,
      });
      
      // 이동 중지
      medicMovement?.stop();
    } else {
      // 타겟에게 접근
      medicMovement?.setTarget(targetPos.x, targetPos.y);
    }
  }
}
