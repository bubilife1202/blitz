// ==========================================
// CommandExecutor - 원격 명령 적용
// ==========================================

import type { GameState } from '@core/GameState';
import type { PathfindingService } from '@core/PathfindingService';
import type { Entity } from '@core/ecs/Entity';
import { Position } from '@core/components/Position';
import { Movement } from '@core/components/Movement';
import { Combat } from '@core/components/Combat';
import { Gatherer } from '@core/components/Gatherer';
import { Owner } from '@core/components/Owner';
import { Building } from '@core/components/Building';
import { Builder } from '@core/components/Builder';
import { Unit } from '@core/components/Unit';
import { ProductionQueue } from '@core/components/ProductionQueue';
import { ResearchQueue } from '@core/components/ResearchQueue';
import { Resource } from '@core/components/Resource';
import { BUILDING_STATS, UNIT_STATS, UPGRADE_STATS, canTrainUnit } from '@shared/constants';
import {
  BuildingType,
  CommandType,
  ResourceType,
  UnitType,
  type GameCommand,
  type PlayerId,
} from '@shared/types';

export class CommandExecutor {
  private gameState: GameState;
  private pathfinding: PathfindingService;

  constructor(gameState: GameState, pathfinding: PathfindingService) {
    this.gameState = gameState;
    this.pathfinding = pathfinding;
  }

  execute(command: GameCommand): void {
    switch (command.type) {
      case CommandType.MOVE:
        void this.executeMove(command);
        return;
      case CommandType.ATTACK:
        this.executeAttack(command);
        return;
      case CommandType.GATHER:
        this.executeGather(command);
        return;
      case CommandType.STOP:
        this.executeStop(command);
        return;
      case CommandType.HOLD:
        this.executeHold(command);
        return;
      case CommandType.BUILD:
        this.executeBuild(command);
        return;
      case CommandType.TRAIN:
        this.executeTrain(command);
        return;
      case CommandType.RESEARCH:
        this.executeResearch(command);
        return;
      case CommandType.SIEGE:
        this.executeSiege(command);
        return;
      case CommandType.STIM:
        this.executeStim(command);
        return;
      default:
        return;
    }
  }

  private async executeMove(command: GameCommand): Promise<void> {
    const target = command.targetPosition;
    if (!target) return;

    for (const entityId of command.entityIds) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) continue;

      const position = entity.getComponent<Position>(Position);
      const movement = entity.getComponent<Movement>(Movement);
      if (!position || !movement) continue;

      const targetPos = command.entityTargets?.[entityId] ?? target;
      const path = command.entityPaths?.[entityId];

      if (path && path.length > 0) {
        movement.setPath(path);
        continue;
      }

      const foundPath = await this.pathfinding.findPath(
        position.x,
        position.y,
        targetPos.x,
        targetPos.y
      );
      if (foundPath.length > 0) {
        movement.setPath(foundPath);
      } else {
        movement.setTarget(targetPos.x, targetPos.y);
      }
    }
  }

  private executeAttack(command: GameCommand): void {
    const targetPos = command.targetPosition;

    for (const entityId of command.entityIds) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) continue;

      const combat = entity.getComponent<Combat>(Combat);
      const movement = entity.getComponent<Movement>(Movement);
      if (!combat) continue;

      combat.releaseHold();

      if (command.targetEntityId) {
        combat.setTarget(command.targetEntityId);
        if (movement && targetPos) {
          movement.setTarget(targetPos.x, targetPos.y);
        }
      } else if (targetPos) {
        combat.startAttackMove(targetPos.x, targetPos.y);
        if (movement) {
          movement.setTarget(targetPos.x, targetPos.y);
        }
      }
    }
  }

  private executeGather(command: GameCommand): void {
    const targetPos = command.targetPosition;
    if (!command.targetEntityId || !targetPos) return;

    const commandCenter = this.findNearestCommandCenter(command.playerId, targetPos.x, targetPos.y);
    if (!commandCenter) return;

    for (const entityId of command.entityIds) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) continue;

      const gatherer = entity.getComponent<Gatherer>(Gatherer);
      const movement = entity.getComponent<Movement>(Movement);
      if (!gatherer) continue;

      gatherer.startGathering(command.targetEntityId, commandCenter.id);
      if (movement) {
        movement.setTarget(targetPos.x, targetPos.y);
      }
    }
  }

  private executeStop(command: GameCommand): void {
    for (const entityId of command.entityIds) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) continue;
      const movement = entity.getComponent<Movement>(Movement);
      movement?.stop();
    }
  }

  private executeHold(command: GameCommand): void {
    for (const entityId of command.entityIds) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) continue;

      const movement = entity.getComponent<Movement>(Movement);
      const combat = entity.getComponent<Combat>(Combat);
      movement?.stop();
      combat?.holdPosition();
    }
  }

  private executeBuild(command: GameCommand): void {
    if (!command.buildingType || !command.targetPosition) return;

    const { buildingType, targetPosition } = command;
    let buildX = targetPosition.x;
    let buildY = targetPosition.y;

    if (buildingType === BuildingType.REFINERY) {
      const geyser = this.findGasGeyserAt(buildX, buildY);
      if (geyser) {
        buildX = geyser.position.x;
        buildY = geyser.position.y;
      }
    }

    if (!this.isValidPlacement(buildX, buildY, buildingType)) return;

    const builder = this.findBuilderForCommand(command.playerId, command.entityIds, buildX, buildY);
    if (!builder) return;

    const stats = BUILDING_STATS[buildingType];
    const resources = this.gameState.getPlayerResources(command.playerId);
    if (!resources) return;

    if (resources.minerals < stats.mineralCost || resources.gas < stats.gasCost) return;

    this.gameState.modifyPlayerResources(command.playerId, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });

    const builderComp = builder.getComponent<Builder>(Builder);
    const movement = builder.getComponent<Movement>(Movement);
    const gatherer = builder.getComponent<Gatherer>(Gatherer);

    if (!builderComp) return;

    builderComp.startBuildCommand(buildingType, buildX, buildY);
    if (movement) {
      const centerX = buildX + (stats.size.width * this.gameState.config.tileSize) / 2;
      const centerY = buildY + (stats.size.height * this.gameState.config.tileSize) / 2;
      movement.setTarget(centerX, centerY);
    }
    gatherer?.stop();
  }

  private executeTrain(command: GameCommand): void {
    if (!command.unitType) return;
    const entity = this.getPrimaryEntity(command.entityIds);
    if (!entity) return;

    const owner = entity.getComponent<Owner>(Owner);
    const building = entity.getComponent<Building>(Building);
    const queue = entity.getComponent<ProductionQueue>(ProductionQueue);

    if (!owner || owner.playerId !== command.playerId) return;
    if (!building || !queue || building.isConstructing) return;

    const buildingStats = BUILDING_STATS[building.buildingType];
    if (!buildingStats.canProduce || !buildingStats.canProduce.includes(command.unitType)) return;

    const playerBuildings = this.getPlayerBuildingTypes(command.playerId);
    if (!canTrainUnit(command.unitType, playerBuildings)) return;

    const stats = UNIT_STATS[command.unitType];
    const resources = this.gameState.getPlayerResources(command.playerId);
    if (!resources) return;

    if (resources.minerals < stats.mineralCost) return;
    if (resources.gas < stats.gasCost) return;
    if (resources.supply + stats.supplyCost > resources.supplyMax) return;

    this.gameState.modifyPlayerResources(command.playerId, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
    queue.addToQueue(command.unitType, stats.buildTime);
  }

  private executeResearch(command: GameCommand): void {
    if (!command.upgradeType) return;
    const entity = this.getPrimaryEntity(command.entityIds);
    if (!entity) return;

    const owner = entity.getComponent<Owner>(Owner);
    const building = entity.getComponent<Building>(Building);
    if (!owner || owner.playerId !== command.playerId) return;
    if (!building || building.isConstructing) return;

    let researchQueue = entity.getComponent<ResearchQueue>(ResearchQueue);
    if (!researchQueue) {
      researchQueue = new ResearchQueue();
      entity.addComponent(researchQueue);
    }

    if (researchQueue.isResearching()) return;

    const stats = UPGRADE_STATS[command.upgradeType];
    const resources = this.gameState.getPlayerResources(command.playerId);
    if (!resources) return;

    if (resources.minerals < stats.mineralCost) return;
    if (resources.gas < stats.gasCost) return;

    this.gameState.modifyPlayerResources(command.playerId, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
    researchQueue.startResearch(command.upgradeType, stats.researchTime);
  }

  private executeSiege(command: GameCommand): void {
    for (const entityId of command.entityIds) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) continue;
      const unit = entity.getComponent<Unit>(Unit);
      if (unit?.unitType === UnitType.SIEGE_TANK) {
        unit.toggleSiege();
      }
    }
  }

  private executeStim(command: GameCommand): void {
    for (const entityId of command.entityIds) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) continue;
      const unit = entity.getComponent<Unit>(Unit);
      if (!unit) continue;
      if (unit.unitType === UnitType.MARINE || unit.unitType === UnitType.FIREBAT) {
        unit.activateStim();
      }
    }
  }

  private getPrimaryEntity(entityIds: number[]): Entity | null {
    if (entityIds.length === 0) return null;
    return this.gameState.getEntity(entityIds[0]) || null;
  }

  private getPlayerBuildingTypes(playerId: PlayerId): BuildingType[] {
    const types: BuildingType[] = [];
    for (const entity of this.gameState.getAllEntities()) {
      const owner = entity.getComponent<Owner>(Owner);
      const building = entity.getComponent<Building>(Building);
      if (owner?.playerId !== playerId || !building || building.isConstructing) continue;
      if (!types.includes(building.buildingType)) {
        types.push(building.buildingType);
      }
    }
    return types;
  }

  private findNearestCommandCenter(playerId: PlayerId, x: number, y: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entity of this.gameState.getAllEntities()) {
      const building = entity.getComponent<Building>(Building);
      const owner = entity.getComponent<Owner>(Owner);
      const position = entity.getComponent<Position>(Position);

      if (!building || !owner || !position) continue;
      if (building.buildingType !== BuildingType.COMMAND_CENTER) continue;
      if (owner.playerId !== playerId) continue;
      if (building.isConstructing) continue;

      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private findGasGeyserAt(x: number, y: number): { entity: Entity; position: Position } | null {
    const checkRadius = this.gameState.config.tileSize * 2;
    for (const entity of this.gameState.getAllEntities()) {
      const resource = entity.getComponent<Resource>(Resource);
      const position = entity.getComponent<Position>(Position);
      if (!resource || !position) continue;
      if (resource.resourceType !== ResourceType.GAS) continue;

      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (dist < checkRadius) {
        return { entity, position };
      }
    }
    return null;
  }

  private isValidPlacement(x: number, y: number, buildingType: BuildingType): boolean {
    const stats = BUILDING_STATS[buildingType];
    const tileX = Math.floor(x / this.gameState.config.tileSize);
    const tileY = Math.floor(y / this.gameState.config.tileSize);

    if (
      tileX < 0 ||
      tileY < 0 ||
      tileX + stats.size.width > this.gameState.config.mapWidth ||
      tileY + stats.size.height > this.gameState.config.mapHeight
    ) {
      return false;
    }

    if (buildingType === BuildingType.REFINERY) {
      const geyser = this.findGasGeyserAt(x, y);
      if (!geyser) return false;
    }

    for (const entity of this.gameState.getAllEntities()) {
      const building = entity.getComponent<Building>(Building);
      const position = entity.getComponent<Position>(Position);
      if (!building || !position) continue;

      const bTileX = Math.floor(position.x / this.gameState.config.tileSize);
      const bTileY = Math.floor(position.y / this.gameState.config.tileSize);

      if (
        tileX < bTileX + building.width &&
        tileX + stats.size.width > bTileX &&
        tileY < bTileY + building.height &&
        tileY + stats.size.height > bTileY
      ) {
        return false;
      }
    }

    return true;
  }

  private findBuilderForCommand(
    playerId: PlayerId,
    entityIds: number[],
    x: number,
    y: number
  ): Entity | null {
    const candidates = entityIds.length > 0 ? entityIds : this.getPlayerBuilderIds(playerId);
    let nearest: Entity | null = null;
    let nearestDist = Infinity;

    for (const entityId of candidates) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) continue;
      const owner = entity.getComponent<Owner>(Owner);
      const builder = entity.getComponent<Builder>(Builder);
      const position = entity.getComponent<Position>(Position);
      if (!owner || owner.playerId !== playerId || !builder || !position) continue;

      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }

    return nearest;
  }

  private getPlayerBuilderIds(playerId: PlayerId): number[] {
    const result: number[] = [];
    for (const entity of this.gameState.getAllEntities()) {
      const owner = entity.getComponent<Owner>(Owner);
      const builder = entity.getComponent<Builder>(Builder);
      if (!owner || owner.playerId !== playerId || !builder) continue;
      result.push(entity.id);
    }
    return result;
  }
}
