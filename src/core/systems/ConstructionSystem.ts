// ==========================================
// ConstructionSystem - 건물 건설 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Building } from '../components/Building';
import { Owner } from '../components/Owner';
import { BUILDING_STATS } from '@shared/constants';

export class ConstructionSystem extends System {
  readonly requiredComponents = [Building.type, Owner.type];
  readonly priority = 25;

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    for (const entity of entities) {
      const building = entity.getComponent<Building>(Building)!;
      const owner = entity.getComponent<Owner>(Owner)!;

      if (!building.isConstructing) continue;

      // 건설 진행 (틱당 일정량)
      const stats = BUILDING_STATS[building.buildingType];
      const progressPerTick = 100 / stats.buildTime;
      
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
      }
    }
  }
}
