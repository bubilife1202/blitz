// ==========================================
// GatherSystem - 자원 채취 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Position } from '../components/Position';
import { Movement } from '../components/Movement';
import { Owner } from '../components/Owner';
import { Gatherer, GathererState } from '../components/Gatherer';
import { Resource } from '../components/Resource';
import { Building } from '../components/Building';
import { BuildingType, ResourceType, type PlayerId } from '@shared/types';

export class GatherSystem extends System {
  readonly requiredComponents = [Position.type, Gatherer.type, Movement.type, Owner.type];
  readonly priority = 20;

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position)!;
      const gatherer = entity.getComponent<Gatherer>(Gatherer)!;
      const movement = entity.getComponent<Movement>(Movement)!;
      const owner = entity.getComponent<Owner>(Owner)!;

      switch (gatherer.state) {
        case GathererState.IDLE:
          // 대기 중
          break;

        case GathererState.MOVING_TO_RESOURCE:
          this.handleMovingToResource(entity, position, gatherer, movement, gameState);
          break;

        case GathererState.GATHERING:
          this.handleGathering(entity, position, gatherer, movement, owner, gameState);
          break;

        case GathererState.RETURNING:
          this.handleReturning(entity, position, gatherer, movement, owner, gameState);
          break;
      }
    }
  }

  private handleMovingToResource(
    _entity: Entity,
    position: Position,
    gatherer: Gatherer,
    movement: Movement,
    gameState: GameState
  ): void {
    if (!gatherer.targetResourceId) {
      gatherer.stop();
      return;
    }

    const resourceEntity = gameState.getEntity(gatherer.targetResourceId);
    if (!resourceEntity) {
      gatherer.stop();
      return;
    }

    const resourcePos = resourceEntity.getComponent<Position>(Position);
    if (!resourcePos) {
      gatherer.stop();
      return;
    }

    const distance = position.distanceTo(resourcePos);
    
    // 자원에 도착했으면 채취 시작
    if (distance < 40 && !movement.isMoving) {
      gatherer.state = GathererState.GATHERING;
      gatherer.gatherTimer = 0;
      movement.stop();
    }
  }

  private handleGathering(
    _entity: Entity,
    position: Position,
    gatherer: Gatherer,
    movement: Movement,
    owner: Owner,
    gameState: GameState
  ): void {
    if (!gatherer.targetResourceId) {
      gatherer.stop();
      return;
    }

    const resourceEntity = gameState.getEntity(gatherer.targetResourceId);
    if (!resourceEntity) {
      gatherer.stop();
      return;
    }

    // Refinery인 경우 연결된 가스 간헐천에서 채취
    let resource: Resource | undefined;
    const building = resourceEntity.getComponent<Building>(Building);
    
    if (building && building.buildingType === BuildingType.REFINERY) {
      // Refinery는 건설 완료되어야 채취 가능
      if (building.isConstructing) {
        gatherer.stop();
        return;
      }
      // 연결된 가스 간헐천에서 자원 가져오기
      if (building.linkedGeyserId) {
        const geyser = gameState.getEntity(building.linkedGeyserId);
        resource = geyser?.getComponent<Resource>(Resource);
      }
    } else {
      resource = resourceEntity.getComponent<Resource>(Resource);
    }

    if (!resource || resource.isDepleted()) {
      // 자원 고갈, 다른 자원 찾기
      gatherer.stop();
      return;
    }

    gatherer.gatherTimer++;

    if (gatherer.gatherTimer >= gatherer.gatherTime) {
      // 채취 완료
      const gathered = resource.gather(1);
      gatherer.carryingAmount = Math.min(
        gatherer.carryingCapacity,
        gatherer.carryingAmount + gathered
      );
      gatherer.gatherTimer = 0;

      if (gatherer.isFull()) {
        // 자원 반납하러 가기
        gatherer.state = GathererState.RETURNING;
        
        // 가장 가까운 커맨드 센터 찾기 (내 소유만)
        const returnBuilding = this.findNearestCommandCenter(position, owner.playerId, gameState);
        if (returnBuilding) {
          gatherer.returnBuildingId = returnBuilding.id;
          const buildingPos = returnBuilding.getComponent<Position>(Position)!;
          movement.setTarget(buildingPos.x, buildingPos.y);
        }
      }
    }
  }

  private handleReturning(
    _entity: Entity,
    position: Position,
    gatherer: Gatherer,
    movement: Movement,
    owner: Owner,
    gameState: GameState
  ): void {
    if (!gatherer.returnBuildingId) {
      gatherer.stop();
      return;
    }

    const buildingEntity = gameState.getEntity(gatherer.returnBuildingId);
    if (!buildingEntity) {
      gatherer.stop();
      return;
    }

    const buildingPos = buildingEntity.getComponent<Position>(Position);
    if (!buildingPos) {
      gatherer.stop();
      return;
    }

    const distance = position.distanceTo(buildingPos);
    
    // 건물에 도착했으면 자원 반납
    if (distance < 60 && !movement.isMoving) {
      const amount = gatherer.deposit();
      
      // 자원 타입 확인 (Refinery인 경우 가스)
      const targetEntity = gameState.getEntity(gatherer.targetResourceId!);
      const targetBuilding = targetEntity?.getComponent<Building>(Building);
      const isGas = targetBuilding?.buildingType === BuildingType.REFINERY || 
                    targetEntity?.getComponent<Resource>(Resource)?.resourceType === ResourceType.GAS;
      
      // 플레이어 자원 추가
      if (isGas) {
        gameState.modifyPlayerResources(owner.playerId, {
          gas: amount,
        });
      } else {
        gameState.modifyPlayerResources(owner.playerId, {
          minerals: amount,
        });
      }

      // 다시 채취하러 가기
      if (gatherer.targetResourceId) {
        const resourceEntity = gameState.getEntity(gatherer.targetResourceId);
        if (resourceEntity) {
          const resourcePos = resourceEntity.getComponent<Position>(Position);
          if (resourcePos) {
            gatherer.state = GathererState.MOVING_TO_RESOURCE;
            movement.setTarget(resourcePos.x, resourcePos.y);
            return;
          }
        }
      }
      
      gatherer.stop();
    }
  }

  private findNearestCommandCenter(position: Position, playerId: PlayerId, gameState: GameState): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of gameState.getAllEntities()) {
      const building = entity.getComponent<Building>(Building);
      const owner = entity.getComponent<Owner>(Owner);
      if (!building || !owner) continue;
      if (building.buildingType !== BuildingType.COMMAND_CENTER) continue;
      if (building.isConstructing) continue;
      // 내 소유의 커맨드센터만
      if (owner.playerId !== playerId) continue;

      const buildingPos = entity.getComponent<Position>(Position);
      if (!buildingPos) continue;

      const dist = position.distanceTo(buildingPos);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }
}
