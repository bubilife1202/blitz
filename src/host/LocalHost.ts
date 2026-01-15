// ==========================================
// LocalHost - 싱글플레이어용 로컬 서버
// ==========================================

import type { GameState } from '@core/GameState';
import type { PathfindingService } from '@core/PathfindingService';
import type { GameCommand } from '@shared/types';
import { UnitType, BuildingType, ResourceType } from '@shared/types';
import { Position } from '@core/components/Position';
import { Selectable } from '@core/components/Selectable';
import { Owner } from '@core/components/Owner';
import { Unit } from '@core/components/Unit';
import { Movement } from '@core/components/Movement';
import { Combat } from '@core/components/Combat';
import { Gatherer } from '@core/components/Gatherer';
import { Building } from '@core/components/Building';
import { ProductionQueue } from '@core/components/ProductionQueue';
import { ResearchQueue } from '@core/components/ResearchQueue';
import { Resource } from '@core/components/Resource';
import { UNIT_STATS, BUILDING_STATS, MINERAL_AMOUNT, MINERAL_GATHER_RATE, GAS_AMOUNT, GAS_GATHER_RATE } from '@shared/constants';

export class LocalHost {
  private gameState: GameState;
  private pathfinding: PathfindingService | null;

  constructor(gameState: GameState, pathfinding?: PathfindingService) {
    this.gameState = gameState;
    this.pathfinding = pathfinding || null;
  }

  setupInitialEntities(): void {
    console.log('LocalHost: Setting up initial entities...');

    const tileSize = this.gameState.config.tileSize;
    const mapSize = this.gameState.config.mapWidth * tileSize;

    // ====== 플레이어 1 (좌측 상단) ======
    // 커맨드 센터
    this.createBuilding(BuildingType.COMMAND_CENTER, 1, 6 * tileSize, 8 * tileSize, true);
    // 배럭
    this.createBuilding(BuildingType.BARRACKS, 1, 12 * tileSize, 8 * tileSize, true);
    // 서플라이 디팟
    this.createBuilding(BuildingType.SUPPLY_DEPOT, 1, 3 * tileSize, 8 * tileSize, true);

    // SCV
    this.createUnit(UnitType.SCV, 1, 5 * tileSize, 5 * tileSize);
    this.createUnit(UnitType.SCV, 1, 6 * tileSize, 5 * tileSize);
    this.createUnit(UnitType.SCV, 1, 7 * tileSize, 5 * tileSize);
    this.createUnit(UnitType.SCV, 1, 8 * tileSize, 5 * tileSize);

    // 마린
    this.createUnit(UnitType.MARINE, 1, 10 * tileSize, 5 * tileSize);
    this.createUnit(UnitType.MARINE, 1, 11 * tileSize, 5 * tileSize);
    this.createUnit(UnitType.MARINE, 1, 12 * tileSize, 5 * tileSize);
    this.createUnit(UnitType.MARINE, 1, 13 * tileSize, 5 * tileSize);

    // 미네랄 (플레이어 1 근처)
    this.createMineral(2 * tileSize, 3 * tileSize);
    this.createMineral(3 * tileSize, 3 * tileSize);
    this.createMineral(4 * tileSize, 3 * tileSize);
    this.createMineral(5 * tileSize, 3 * tileSize);
    this.createMineral(6 * tileSize, 3 * tileSize);
    this.createMineral(7 * tileSize, 3 * tileSize);
    this.createMineral(8 * tileSize, 3 * tileSize);
    this.createMineral(9 * tileSize, 3 * tileSize);
    
    // 가스 (플레이어 1 근처)
    this.createGasGeyser(11 * tileSize, 3 * tileSize);
    this.createGasGeyser(12 * tileSize, 3 * tileSize);

    // ====== 플레이어 2 (AI - 우측 하단) ======
    const p2BaseX = mapSize - 8 * tileSize;
    const p2BaseY = mapSize - 10 * tileSize;

    // 커맨드 센터
    this.createBuilding(BuildingType.COMMAND_CENTER, 2, p2BaseX, p2BaseY, true);
    // 배럭
    this.createBuilding(BuildingType.BARRACKS, 2, p2BaseX - 6 * tileSize, p2BaseY, true);

    // SCV
    this.createUnit(UnitType.SCV, 2, p2BaseX + tileSize, p2BaseY - 3 * tileSize);
    this.createUnit(UnitType.SCV, 2, p2BaseX + 2 * tileSize, p2BaseY - 3 * tileSize);

    // 마린
    this.createUnit(UnitType.MARINE, 2, p2BaseX - 2 * tileSize, p2BaseY - 3 * tileSize);
    this.createUnit(UnitType.MARINE, 2, p2BaseX - 3 * tileSize, p2BaseY - 3 * tileSize);
    this.createUnit(UnitType.MARINE, 2, p2BaseX - 4 * tileSize, p2BaseY - 3 * tileSize);
    this.createUnit(UnitType.MARINE, 2, p2BaseX - 5 * tileSize, p2BaseY - 3 * tileSize);

    // 미네랄 (플레이어 2 근처)
    for (let i = 0; i < 8; i++) {
      this.createMineral(mapSize - (2 + i) * tileSize, mapSize - 3 * tileSize);
    }
    
    // 가스 (플레이어 2 근처)
    this.createGasGeyser(mapSize - 11 * tileSize, mapSize - 3 * tileSize);
    this.createGasGeyser(mapSize - 12 * tileSize, mapSize - 3 * tileSize);

    // 플레이어 자원 초기화
    this.gameState.modifyPlayerResources(1, { 
      minerals: 200,  // 추가 미네랄
      supply: 8,      // 4 SCV + 4 Marine
      supplyMax: 18   // CC(10) + Depot(8)
    });
    this.gameState.modifyPlayerResources(2, { 
      minerals: 200,
      supply: 6,      // 2 SCV + 4 Marine
      supplyMax: 10   // CC(10)
    });

    console.log(`Created ${this.gameState.getAllEntities().length} entities`);
  }

  private createUnit(unitType: UnitType, playerId: number, x: number, y: number): void {
    const entity = this.gameState.createEntity();
    const stats = UNIT_STATS[unitType];

    entity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(16))
      .addComponent(new Owner(playerId))
      .addComponent(new Unit(unitType))
      .addComponent(new Movement(stats.moveSpeed * 32))
      .addComponent(new Combat());

    if (unitType === UnitType.SCV) {
      entity.addComponent(new Gatherer(8));
    }
  }

  private createBuilding(
    buildingType: BuildingType,
    playerId: number,
    x: number,
    y: number,
    constructed: boolean = false
  ): void {
    const entity = this.gameState.createEntity();

    entity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(32))
      .addComponent(new Owner(playerId))
      .addComponent(new Building(buildingType, constructed));

    // 생산 가능 건물에 ProductionQueue 추가
    const stats = BUILDING_STATS[buildingType];
    if (stats.canProduce && stats.canProduce.length > 0) {
      entity.addComponent(new ProductionQueue(5));
    }

    // 연구 가능 건물에 ResearchQueue 추가
    if (stats.canResearch && stats.canResearch.length > 0) {
      entity.addComponent(new ResearchQueue());
    }

    // 패스파인딩 장애물 등록
    if (this.pathfinding) {
      const building = entity.getComponent<Building>(Building)!;
      const tileSize = this.gameState.config.tileSize;
      const tileX = Math.floor(x / tileSize);
      const tileY = Math.floor(y / tileSize);

      for (let dy = 0; dy < building.height; dy++) {
        for (let dx = 0; dx < building.width; dx++) {
          this.pathfinding.setObstacle(tileX + dx - 1, tileY + dy - 1);
        }
      }
    }
  }

  private createMineral(x: number, y: number): void {
    const entity = this.gameState.createEntity();

    entity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(12))
      .addComponent(new Resource(ResourceType.MINERALS, MINERAL_AMOUNT, MINERAL_GATHER_RATE));
  }

  private createGasGeyser(x: number, y: number): void {
    const entity = this.gameState.createEntity();

    entity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(16))
      .addComponent(new Resource(ResourceType.GAS, GAS_AMOUNT, GAS_GATHER_RATE));
  }

  receiveCommand(command: GameCommand): void {
    if (this.validateCommand(command)) {
      const executeTick = this.gameState.getCurrentTick() + 1;
      this.gameState.queueCommand({
        ...command,
        tick: executeTick,
      });
    }
  }

  private validateCommand(command: GameCommand): boolean {
    const player = this.gameState.getPlayer(command.playerId);
    if (!player || player.isDefeated) {
      return false;
    }

    for (const entityId of command.entityIds) {
      const entity = this.gameState.getEntity(entityId);
      if (!entity) {
        return false;
      }

      const owner = entity.getComponent<Owner>(Owner);
      if (!owner || owner.playerId !== command.playerId) {
        return false;
      }
    }

    return true;
  }
}
