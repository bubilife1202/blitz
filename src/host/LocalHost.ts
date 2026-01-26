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
import { Builder } from '@core/components/Builder';
import { Building } from '@core/components/Building';
import { ProductionQueue } from '@core/components/ProductionQueue';
import { ResearchQueue } from '@core/components/ResearchQueue';
import { Resource } from '@core/components/Resource';
import { UNIT_STATS, BUILDING_STATS, MINERAL_AMOUNT, MINERAL_GATHER_RATE, GAS_AMOUNT, GAS_GATHER_RATE } from '@shared/constants';
import { type GameMap, getMap, getRandomMap } from '@shared/maps';

export class LocalHost {
  private gameState: GameState;
  private pathfinding: PathfindingService | null;
  private aiCount: number = 1;
  private humanPlayers: Set<number> = new Set([1]);
  private currentMap: GameMap | null = null;

  constructor(gameState: GameState, pathfinding?: PathfindingService) {
    this.gameState = gameState;
    this.pathfinding = pathfinding || null;
  }

  setAICount(count: number): void {
    this.aiCount = Math.min(3, Math.max(1, count));
  }

  setHumanPlayers(ids: number[]): void {
    this.humanPlayers = new Set(ids);
  }

  getAICount(): number {
    return this.aiCount;
  }

  getCurrentMap(): GameMap | null {
    return this.currentMap;
  }

  setupInitialEntities(): void {
    console.log(`LocalHost: Setting up initial entities (1 vs ${this.aiCount})...`);

    const tileSize = this.gameState.config.tileSize;
    const mapId = this.gameState.config.mapId;
    
    // 맵 데이터 로드 (mapId가 없으면 랜덤 맵)
    this.currentMap = mapId ? getMap(mapId) || getRandomMap() : getRandomMap();
    console.log(`LocalHost: Using map "${this.currentMap.name}" (${this.currentMap.id})`);

    // 배치 모드 시작
    if (this.pathfinding) {
      this.pathfinding.beginBatch();
    }

    // 맵 지형을 패스파인딩에 적용
    if (this.currentMap && this.pathfinding) {
      this.pathfinding.applyTerrainFromMap(this.currentMap);
    }

    // 플레이어 슬롯 설정
    const totalPlayers = 1 + this.aiCount;
    const startLocations = this.currentMap.startLocations.slice(0, totalPlayers);
    
    const playerSlots: Array<{ id: number; positionIndex: number }> = [{ id: 1, positionIndex: 0 }];
    for (let i = 0; i < this.aiCount; i++) {
      playerSlots.push({ id: 2 + i, positionIndex: i + 1 });
    }

    for (const slot of playerSlots) {
      const isHuman = this.humanPlayers.has(slot.id);
      this.gameState.modifyPlayerResources(slot.id, {
        minerals: 200,
        supply: isHuman ? 8 : 6,
        supplyMax: isHuman ? 18 : 10,
      });
    }

    // 플레이어 베이스 및 자원 배치
    for (const slot of playerSlots) {
      const isHuman = this.humanPlayers.has(slot.id);
      const startLoc = startLocations[slot.positionIndex];
      
      if (startLoc) {
        this.setupPlayerBaseFromMap(slot.id, startLoc, tileSize, isHuman);
      }
    }

    // 확장 자원 배치
    this.setupExpansions(tileSize);

    // 배치 모드 종료
    if (this.pathfinding) {
      this.pathfinding.endBatch();
    }

    console.log(`Created ${this.gameState.getAllEntities().length} entities`);
  }

  // 맵 데이터 기반 플레이어 베이스 설정
  private setupPlayerBaseFromMap(
    playerId: number,
    startLoc: { x: number; y: number; resources: Array<{ x: number; y: number; type: string; amount?: number }> },
    tileSize: number,
    isHuman: boolean
  ): void {
    const baseX = startLoc.x * tileSize;
    const baseY = startLoc.y * tileSize;

    // 커맨드 센터
    this.createBuilding(BuildingType.HQ, playerId, baseX, baseY, true);
    // 배럭
    this.createBuilding(BuildingType.BARRACKS, playerId, baseX + 6 * tileSize, baseY, true);

    // 인간 플레이어는 서플라이 디팟 추가
    if (isHuman) {
      this.createBuilding(BuildingType.DEPOT, playerId, baseX - 3 * tileSize, baseY, true);
    }

    // SCV
    const scvCount = isHuman ? 4 : 2;
    for (let i = 0; i < scvCount; i++) {
      this.createUnit(UnitType.ENGINEER, playerId, baseX - tileSize + i * tileSize, baseY - 3 * tileSize);
    }

    // 마린
    const marineCount = 4;
    for (let i = 0; i < marineCount; i++) {
      this.createUnit(UnitType.TROOPER, playerId, baseX + 4 * tileSize + i * tileSize, baseY - 3 * tileSize);
    }

    // 시작 위치 자원 배치
    for (const res of startLoc.resources) {
      const resX = res.x * tileSize;
      const resY = res.y * tileSize;
      if (res.type === 'minerals') {
        this.createMineral(resX, resY, res.amount);
      } else if (res.type === 'gas') {
        this.createGasGeyser(resX, resY, res.amount);
      }
    }
  }

  // 확장 자원 배치
  private setupExpansions(tileSize: number): void {
    if (!this.currentMap) return;

    for (const expansion of this.currentMap.expansions) {
      for (const res of expansion.resources) {
        const resX = res.x * tileSize;
        const resY = res.y * tileSize;
        if (res.type === 'minerals') {
          this.createMineral(resX, resY, res.amount);
        } else if (res.type === 'gas') {
          this.createGasGeyser(resX, resY, res.amount);
        }
      }
    }
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

    if (unitType === UnitType.ENGINEER) {
      entity.addComponent(new Gatherer(8));
      entity.addComponent(new Builder());
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
          this.pathfinding.setObstacle(tileX + dx, tileY + dy);
        }
      }
    }
  }

  private createMineral(x: number, y: number, amount?: number): void {
    const entity = this.gameState.createEntity();

    entity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(12))
      .addComponent(new Resource(ResourceType.MINERALS, amount ?? MINERAL_AMOUNT, MINERAL_GATHER_RATE));
  }

  private createGasGeyser(x: number, y: number, amount?: number): void {
    const entity = this.gameState.createEntity();

    entity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(16))
      .addComponent(new Resource(ResourceType.GAS, amount ?? GAS_AMOUNT, GAS_GATHER_RATE));
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
