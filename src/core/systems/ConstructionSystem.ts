// ==========================================
// ConstructionSystem - 건물 건설 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Building } from '../components/Building';
import { Owner } from '../components/Owner';
import { Position } from '../components/Position';
import { Builder, BuilderState } from '../components/Builder';
import { BUILDING_STATS, secondsToTicks } from '@shared/constants';

export class ConstructionSystem extends System {
  readonly requiredComponents = [Building.type, Owner.type, Position.type];
  readonly priority = 25;

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    for (const entity of entities) {
      const building = entity.getComponent<Building>(Building)!;
      const owner = entity.getComponent<Owner>(Owner)!;
      const position = entity.getComponent<Position>(Position)!;

      if (!building.isConstructing) continue;

      // Builder SCV가 근처에 있는지 확인
      if (!this.isBuilderNearby(building, position, gameState)) {
        continue; // SCV가 없으면 건설 진행 안 함
      }

      const stats = BUILDING_STATS[building.buildingType];
      const totalTicks = secondsToTicks(stats.buildTime);
      const progressPerTick = 100 / totalTicks;
      
      building.addConstructionProgress(progressPerTick);

      // 건설 완료
      if (!building.isConstructing) {
        console.log(`Building ${building.buildingType} completed for player ${owner.playerId}`);
        
        // 공급량 추가
        if (stats.supplyProvided > 0) {
          gameState.modifyPlayerResources(owner.playerId, {
            supplyMax: stats.supplyProvided,
          });
        }
        
        // Builder 상태 클리어 (building.builderId로 SCV 찾기)
        if (building.builderId !== null) {
          const scv = gameState.getEntity(building.builderId);
          if (scv) {
            const builder = scv.getComponent<Builder>(Builder);
            if (builder) {
              builder.finishBuilding();
            }
          }
          building.builderId = null;
        }
      }
    }
  }

  private isBuilderNearby(
    building: Building,
    buildingPos: Position,
    gameState: GameState
  ): boolean {
    // builderId가 설정되어 있으면 해당 SCV 확인
    if (building.builderId !== null) {
      const scv = gameState.getEntity(building.builderId);
      if (scv) {
        const scvPos = scv.getComponent<Position>(Position);
        const builder = scv.getComponent<Builder>(Builder);
        
        if (scvPos && builder && builder.state === BuilderState.BUILDING) {
          const dist = Math.sqrt(
            Math.pow(scvPos.x - buildingPos.x, 2) + Math.pow(scvPos.y - buildingPos.y, 2)
          );
          // SCV가 건물 근처에 있으면 건설 가능
          return dist < 100;
        }
      }
    }
    
    // builderId가 없거나 유효하지 않으면 건설 진행 안 함
    return false;
  }
}
