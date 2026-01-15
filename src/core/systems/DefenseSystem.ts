// ==========================================
// DefenseSystem - 방어 건물 (미사일 터렛 등) 자동 공격 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Position } from '../components/Position';
import { Owner } from '../components/Owner';
import { Unit } from '../components/Unit';
import { Building } from '../components/Building';
import { BUILDING_STATS, UNIT_STATS } from '@shared/constants';
import { combatEvents } from '../events/CombatEvents';
import { BuildingType } from '@shared/types';

export class DefenseSystem extends System {
  readonly requiredComponents = [Position.type, Building.type, Owner.type];
  readonly priority = 38; // Combat 전에 실행
  
  // 인스턴스 레벨 쿨다운 관리 (전역 X, 문자열 키로 충돌 방지)
  private defenseCooldowns: Map<string, number> = new Map();
  private cleanupCounter: number = 0;
  private readonly CLEANUP_INTERVAL = 160; // 10초마다 정리
  
  // 쿨다운 초기화 (게임 재시작시 호출)
  reset(): void {
    this.defenseCooldowns.clear();
    this.cleanupCounter = 0;
  }

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    // 주기적으로 파괴된 엔티티 쿨다운 정리
    this.cleanupCounter++;
    if (this.cleanupCounter >= this.CLEANUP_INTERVAL) {
      this.cleanupStaleCooldowns(gameState);
      this.cleanupCounter = 0;
    }
    for (const entity of entities) {
      const building = entity.getComponent<Building>(Building)!;
      const position = entity.getComponent<Position>(Position)!;
      const owner = entity.getComponent<Owner>(Owner)!;

      // 건설 중이면 스킵
      if (building.isConstructing) continue;

      const stats = BUILDING_STATS[building.buildingType];
      
      // 벙커 처리 (탑승 유닛이 있을 때만 공격)
      if (building.buildingType === BuildingType.BUNKER) {
        this.handleBunkerAttack(entity, building, position, owner, gameState);
        continue;
      }
      
      // 일반 방어 건물 (미사일 터렛 등)
      if (!stats.isDefense || !stats.damage || !stats.range) continue;

      // 쿨다운 관리 (문자열 키)
      const cooldownKey = `turret_${entity.id}`;
      let cooldown = this.defenseCooldowns.get(cooldownKey) || 0;
      if (cooldown > 0) {
        this.defenseCooldowns.set(cooldownKey, cooldown - 1);
        continue;
      }

      // 사정거리 내 적 찾기
      const target = this.findTarget(position, owner, stats.range, gameState);
      if (!target) continue;

      // 공격 실행
      this.attack(entity, target, position, stats.damage, gameState, 'missile');
      
      // 쿨다운 설정 (attackSpeed 기반)
      const cooldownTicks = Math.floor(16 / (stats.attackSpeed || 1));
      this.defenseCooldowns.set(cooldownKey, cooldownTicks);
    }
  }

  // 벙커 공격 처리
  private handleBunkerAttack(
    bunkerEntity: Entity,
    building: Building,
    position: Position,
    owner: Owner,
    gameState: GameState
  ): void {
    // 탑승 유닛이 없으면 스킵
    if (building.getGarrisonCount() === 0) return;
    
    // 각 탑승 유닛별로 쿨다운 관리 및 공격
    for (const unitId of building.garrisonedUnits) {
      const unit = gameState.getEntity(unitId);
      if (!unit || unit.isDestroyed()) {
        building.ungarrisonUnit(unitId);
        continue;
      }
      
      // 소유권 검증: 유닛이 벙커 소유자와 같은 팀인지 확인
      const unitOwner = unit.getComponent<Owner>(Owner);
      if (!unitOwner || unitOwner.playerId !== owner.playerId) {
        building.ungarrisonUnit(unitId);
        continue;
      }
      
      const unitComp = unit.getComponent<Unit>(Unit);
      if (!unitComp) continue;
      
      const unitStats = UNIT_STATS[unitComp.unitType];
      // 문자열 키로 충돌 방지
      const cooldownKey = `bunker_${bunkerEntity.id}_unit_${unitId}`;
      
      // 쿨다운 체크
      let cooldown = this.defenseCooldowns.get(cooldownKey) || 0;
      if (cooldown > 0) {
        this.defenseCooldowns.set(cooldownKey, cooldown - 1);
        continue;
      }
      
      // 사정거리 (벙커 내 유닛은 사정거리 +1, 유닛 현재 range 사용하여 업그레이드 반영)
      const effectiveRange = unitComp.range + 1;
      const target = this.findTarget(position, owner, effectiveRange, gameState);
      if (!target) continue;
      
      // 프로젝타일 타입 결정
      let projectileType: 'bullet' | 'flame' | 'missile' = 'bullet';
      if (unitComp.unitType === 'firebat') {
        projectileType = 'flame';
      }
      
      // 공격 실행
      this.attack(bunkerEntity, target, position, unitComp.damage, gameState, projectileType);
      
      // 쿨다운 설정 (0 방지)
      const attackSpeed = unitStats.attackSpeed || 1;
      const cooldownTicks = Math.floor(16 / attackSpeed);
      this.defenseCooldowns.set(cooldownKey, cooldownTicks);
    }
  }

  private findTarget(
    position: Position,
    owner: Owner,
    range: number,
    gameState: GameState
  ): Entity | null {
    const rangePx = range * 32;
    let nearestEnemy: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of gameState.getAllEntities()) {
      if (entity.isDestroyed()) continue;

      const entityOwner = entity.getComponent<Owner>(Owner);
      if (!entityOwner || entityOwner.playerId === owner.playerId) continue;

      const entityPos = entity.getComponent<Position>(Position);
      if (!entityPos) continue;

      const unit = entity.getComponent<Unit>(Unit);
      const building = entity.getComponent<Building>(Building);
      if (!unit && !building) continue;

      const dist = position.distanceTo(entityPos);
      if (dist <= rangePx && dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = entity;
      }
    }

    return nearestEnemy;
  }

  private attack(
    _attacker: Entity,
    target: Entity,
    attackerPos: Position,
    damage: number,
    gameState: GameState,
    projectileType: 'bullet' | 'flame' | 'missile' = 'missile'
  ): void {
    const targetPos = target.getComponent<Position>(Position);
    if (!targetPos) return;

    const targetUnit = target.getComponent<Unit>(Unit);
    const targetBuilding = target.getComponent<Building>(Building);

    // 공격 이벤트 발송
    combatEvents.emitAttack({
      attackerX: attackerPos.x,
      attackerY: attackerPos.y,
      targetX: targetPos.x,
      targetY: targetPos.y,
      projectileType,
      damage: damage,
    });

    // 데미지 적용
    if (targetUnit) {
      const actualDamage = targetUnit.takeDamage(damage);

      combatEvents.emitHit({
        x: targetPos.x,
        y: targetPos.y,
        damage: actualDamage,
        isBuilding: false,
      });

      if (targetUnit.isDead()) {
        const size = targetUnit.unitType === 'siege_tank' ? 16
          : targetUnit.unitType === 'goliath' ? 14
          : targetUnit.unitType === 'vulture' ? 14
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
          const unitStats = UNIT_STATS[targetUnit.unitType as keyof typeof UNIT_STATS];
          gameState.modifyPlayerResources(targetOwner.playerId, {
            supply: -unitStats.supplyCost,
          });
        }
        
        target.destroy();
      }
    } else if (targetBuilding) {
      const actualDamage = targetBuilding.takeDamage(damage);

      combatEvents.emitHit({
        x: targetPos.x,
        y: targetPos.y,
        damage: actualDamage,
        isBuilding: true,
      });

      if (targetBuilding.isDestroyed()) {
        combatEvents.emitDeath({
          x: targetPos.x,
          y: targetPos.y,
          size: Math.max(targetBuilding.width, targetBuilding.height) * 32,
          isBuilding: true,
        });
        target.destroy();

        // 건물 파괴시 공급량 감소
        const targetOwner = target.getComponent<Owner>(Owner);
        if (targetOwner) {
          const buildingStats = BUILDING_STATS[targetBuilding.buildingType];
          if (buildingStats.supplyProvided > 0) {
            gameState.modifyPlayerResources(targetOwner.playerId, {
              supplyMax: -buildingStats.supplyProvided,
            });
          }
        }
      }
    }
  }

  // 파괴된 엔티티의 쿨다운 정리
  private cleanupStaleCooldowns(gameState: GameState): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.defenseCooldowns.keys()) {
      // 키에서 엔티티 ID 추출
      const match = key.match(/turret_(\d+)|bunker_(\d+)_unit_(\d+)/);
      if (match) {
        const entityId = parseInt(match[1] || match[2], 10);
        const entity = gameState.getEntity(entityId);
        
        // 엔티티가 없거나 파괴됨
        if (!entity || entity.isDestroyed()) {
          keysToDelete.push(key);
        }
      }
    }
    
    // 일괄 삭제
    for (const key of keysToDelete) {
      this.defenseCooldowns.delete(key);
    }
  }
}
