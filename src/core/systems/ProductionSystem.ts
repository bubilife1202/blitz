// ==========================================
// ProductionSystem - 유닛 생산 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Position } from '../components/Position';
import { Owner } from '../components/Owner';
import { Building } from '../components/Building';
import { ProductionQueue } from '../components/ProductionQueue';
import { Selectable } from '../components/Selectable';
import { Unit } from '../components/Unit';
import { Movement } from '../components/Movement';
import { Combat } from '../components/Combat';
import { Gatherer } from '../components/Gatherer';
import { UnitType, UnitCategory } from '@shared/types';
import { UNIT_STATS } from '@shared/constants';

export class ProductionSystem extends System {
  readonly requiredComponents = [Building.type, ProductionQueue.type, Position.type, Owner.type];
  readonly priority = 30;

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    for (const entity of entities) {
      const building = entity.getComponent<Building>(Building)!;
      const queue = entity.getComponent<ProductionQueue>(ProductionQueue)!;
      const position = entity.getComponent<Position>(Position)!;
      const owner = entity.getComponent<Owner>(Owner)!;

      // 건설 중이면 생산 안 함
      if (building.isConstructing) continue;

      // 현재 생산 중인 유닛의 공급량 체크
      const currentProduction = queue.getCurrentProduction();
      if (currentProduction) {
        const stats = UNIT_STATS[currentProduction.unitType];
        const playerResources = gameState.getPlayerResources(owner.playerId);
        
        // 공급량 부족하면 생산 진행 안 함 (대기)
        if (playerResources && playerResources.supply + stats.supplyCost > playerResources.supplyMax) {
          // 생산 진행하지 않고 대기
          continue;
        }
      }

      // 생산 진행
      const completedUnit = queue.advanceProduction(1);
      
      if (completedUnit) {
        // 유닛 생성
        this.spawnUnit(completedUnit, position, owner.playerId, building, gameState);
      }
    }
  }

  private spawnUnit(
    unitType: UnitType,
    buildingPos: Position,
    playerId: number,
    building: Building,
    gameState: GameState
  ): void {
    const stats = UNIT_STATS[unitType];
    
    const playerResources = gameState.getPlayerResources(playerId);
    if (!playerResources) return;

    // 스폰 위치 (건물 근처, 약간의 랜덤성 추가)
    const spawnOffset = 50 + Math.random() * 20;
    const angle = Math.random() * Math.PI * 2;
    const spawnX = building.rallyPointX ?? (buildingPos.x + Math.cos(angle) * spawnOffset);
    const spawnY = building.rallyPointY ?? (buildingPos.y + Math.sin(angle) * spawnOffset);

    // 유닛 생성
    const unit = gameState.createEntity();
    
    // 기본 컴포넌트
    unit
      .addComponent(new Position(spawnX, spawnY))
      .addComponent(new Selectable(stats.category === UnitCategory.VEHICLE ? 20 : 16))
      .addComponent(new Owner(playerId))
      .addComponent(new Unit(unitType))
      .addComponent(new Movement(stats.moveSpeed * 32));
    
    // 전투 가능 유닛에만 Combat 컴포넌트 추가 (Medic 제외)
    if (!stats.isHealer && stats.damage > 0) {
      unit.addComponent(new Combat());
    }

    // SCV는 채취 가능
    if (unitType === UnitType.SCV) {
      unit.addComponent(new Gatherer(8));
    }

    // 공급량 증가
    gameState.modifyPlayerResources(playerId, { supply: stats.supplyCost });

    // 랠리 포인트로 이동
    if (building.rallyPointX !== null && building.rallyPointY !== null) {
      const movement = unit.getComponent<Movement>(Movement)!;
      movement.setTarget(building.rallyPointX, building.rallyPointY);
    }

    console.log(`Spawned ${unitType} for player ${playerId}`);
  }
}
