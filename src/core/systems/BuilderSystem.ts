// ==========================================
// BuilderSystem - SCV 건물 건설 처리
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Builder, BuilderState } from '../components/Builder';
import { Building } from '../components/Building';
import { Position } from '../components/Position';
import { Movement } from '../components/Movement';
import { Owner } from '../components/Owner';
import { Selectable } from '../components/Selectable';
import { ProductionQueue } from '../components/ProductionQueue';
import { ResearchQueue } from '../components/ResearchQueue';
import { Gatherer } from '../components/Gatherer';
import { Resource } from '../components/Resource';
import { BuildingType, ResourceType } from '@shared/types';
import { BUILDING_STATS } from '@shared/constants';

export class BuilderSystem extends System {
  readonly requiredComponents = [Builder.type, Position.type, Movement.type];
  readonly priority = 20; // Before ConstructionSystem

  private pathfindingService: import('../PathfindingService').PathfindingService | null = null;

  private findNearestGasGeyser(x: number, y: number, gameState: GameState): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of gameState.getAllEntities()) {
      const resource = entity.getComponent<Resource>(Resource);
      const pos = entity.getComponent<Position>(Position);
      if (!resource || !pos) continue;
      if (resource.resourceType !== ResourceType.GAS) continue;
      if (resource.isDepleted()) continue;

      const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  // 패스파인딩 서비스 연결
  setPathfindingService(service: import('../PathfindingService').PathfindingService): void {
    this.pathfindingService = service;
  }

  update(entities: Entity[], gameState: GameState, _deltaTime: number): void {
    for (const entity of entities) {
      const builder = entity.getComponent<Builder>(Builder)!;
      const position = entity.getComponent<Position>(Position)!;
      const movement = entity.getComponent<Movement>(Movement)!;
      const owner = entity.getComponent<Owner>(Owner);

      if (builder.state === BuilderState.MOVING_TO_BUILD) {
        this.handleMovingToBuild(entity, builder, position, movement, owner, gameState);
      } else if (builder.state === BuilderState.BUILDING) {
        this.handleBuilding(entity, builder, position, movement, gameState);
      }
    }
  }

  private handleMovingToBuild(
    entity: Entity,
    builder: Builder,
    position: Position,
    movement: Movement,
    owner: Owner | undefined,
    gameState: GameState
  ): void {
    if (builder.buildX === null || builder.buildY === null || !builder.targetBuildingType) {
      builder.finishBuilding();
      return;
    }

    // 건설 위치까지의 거리 확인
    const buildCenterX = builder.buildX + (BUILDING_STATS[builder.targetBuildingType].size.width * gameState.config.tileSize) / 2;
    const buildCenterY = builder.buildY + (BUILDING_STATS[builder.targetBuildingType].size.height * gameState.config.tileSize) / 2;
    const dist = Math.sqrt(Math.pow(position.x - buildCenterX, 2) + Math.pow(position.y - buildCenterY, 2));

    // 건설 범위 도착 확인 (건물 크기에 따라 적절한 거리)
    const arrivalDistance = 50; // 도착 판정 거리

    if (dist <= arrivalDistance && !movement.isMoving) {
      // 도착! 건물 생성
      this.createBuilding(entity, builder, owner, gameState);
    } else if (!movement.isMoving && !movement.hasTarget()) {
      // 이동이 완료되었는데 아직 도착하지 않은 경우 → 다시 이동 시도
      movement.setTarget(buildCenterX, buildCenterY);
    }
  }

  private createBuilding(
    scvEntity: Entity,
    builder: Builder,
    owner: Owner | undefined,
    gameState: GameState
  ): void {
    if (!builder.targetBuildingType || builder.buildX === null || builder.buildY === null) {
      builder.finishBuilding();
      return;
    }

    const buildingType = builder.targetBuildingType;
    const x = builder.buildX;
    const y = builder.buildY;

    // 건물 엔티티 생성
    const buildingEntity = gameState.createEntity();
    const building = new Building(buildingType, false); // isConstructing = true
    building.builderId = scvEntity.id;

    // Refinery는 가장 가까운 가스 간헐천과 연결
    if (buildingType === BuildingType.REFINERY) {
      const geyser = this.findNearestGasGeyser(x, y, gameState);
      if (geyser) {
        building.linkedGeyserId = geyser.id;
      }
    }

    buildingEntity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(32))
      .addComponent(building);

    if (owner) {
      buildingEntity.addComponent(new Owner(owner.playerId));
    }

    // 생산 가능 건물에 ProductionQueue 추가
    const stats = BUILDING_STATS[buildingType];
    if (stats.canProduce && stats.canProduce.length > 0) {
      buildingEntity.addComponent(new ProductionQueue(5));
    }

    // 연구 가능 건물에 ResearchQueue 추가
    if (stats.canResearch && stats.canResearch.length > 0) {
      buildingEntity.addComponent(new ResearchQueue());
    }

    // 패스파인딩 장애물 등록
    if (this.pathfindingService) {
      const tileSize = gameState.config.tileSize;
      const tileX = Math.floor(x / tileSize);
      const tileY = Math.floor(y / tileSize);
      for (let dy = 0; dy < stats.size.height; dy++) {
        for (let dx = 0; dx < stats.size.width; dx++) {
          this.pathfindingService.setObstacle(tileX + dx, tileY + dy);
        }
      }
    }

    console.log(`SCV started building ${buildingType} at (${x}, ${y})`);

    // Builder 상태 업데이트 → 건설 중
    builder.startBuilding(buildingEntity.id);

    // Gatherer 상태 중지 (채취 중이었으면)
    const gatherer = scvEntity.getComponent<Gatherer>(Gatherer);
    if (gatherer) {
      gatherer.stop();
    }
  }

  private handleBuilding(
    _entity: Entity,
    builder: Builder,
    position: Position,
    movement: Movement,
    gameState: GameState
  ): void {
    if (!builder.targetBuildingId) {
      builder.finishBuilding();
      return;
    }

    // 건설 중인 건물 확인
    const buildingEntity = gameState.getEntity(builder.targetBuildingId);
    if (!buildingEntity) {
      // 건물이 파괴됨
      builder.finishBuilding();
      return;
    }

    const building = buildingEntity.getComponent<Building>(Building);
    if (!building) {
      builder.finishBuilding();
      return;
    }

    // 건설 완료 확인
    if (!building.isConstructing) {
      console.log(`Building ${building.buildingType} construction completed!`);
      builder.finishBuilding();
      return;
    }

    // SCV가 건물 근처에 있는지 확인
    const buildingPos = buildingEntity.getComponent<Position>(Position);
    if (buildingPos) {
      const dist = Math.sqrt(
        Math.pow(position.x - buildingPos.x, 2) + Math.pow(position.y - buildingPos.y, 2)
      );

      // 너무 멀어지면 건물 근처로 돌아가기
      const maxDistance = 80;
      if (dist > maxDistance) {
        movement.setTarget(buildingPos.x, buildingPos.y);
      } else {
        // 건물 근처에서 멈추기
        movement.stop();
      }
    }
  }
}
