// ==========================================
// VisionSystem - 시야 및 안개 전쟁 시스템
// ==========================================

import { System } from '../ecs/System';
import type { Entity } from '../ecs/Entity';
import type { GameState } from '../GameState';
import { Position } from '../components/Position';
import { Owner } from '../components/Owner';
import { Unit } from '../components/Unit';
import { Building } from '../components/Building';
import { UNIT_STATS, BUILDING_STATS } from '@shared/constants';

export enum VisibilityState {
  HIDDEN = 0,    // 미탐색
  EXPLORED = 1,  // 탐색됨 (안개)
  VISIBLE = 2,   // 시야 내
}

export class VisionSystem extends System {
  readonly requiredComponents = [Position.type, Owner.type];
  readonly priority = 5; // 가장 먼저 실행

  // 플레이어별 시야 맵
  private visionMaps: Map<number, Uint8Array> = new Map();
  private exploredMaps: Map<number, Uint8Array> = new Map();
  
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  private tileSize: number = 32;

  init(gameState: GameState): void {
    super.init(gameState);
    
    this.mapWidth = gameState.config.mapWidth;
    this.mapHeight = gameState.config.mapHeight;
    this.tileSize = gameState.config.tileSize;
    
    // 플레이어별 시야 맵 초기화
    for (const player of gameState.getAllPlayers()) {
      const size = this.mapWidth * this.mapHeight;
      this.visionMaps.set(player.id, new Uint8Array(size));
      this.exploredMaps.set(player.id, new Uint8Array(size));
    }
  }

  update(entities: Entity[], _gameState: GameState, _deltaTime: number): void {
    // 시야 맵 초기화 (탐색된 영역은 유지)
    for (const [_playerId, visionMap] of this.visionMaps) {
      visionMap.fill(0);
    }

    // 모든 유닛/건물의 시야 계산
    for (const entity of entities) {
      const position = entity.getComponent<Position>(Position)!;
      const owner = entity.getComponent<Owner>(Owner)!;
      const unit = entity.getComponent<Unit>(Unit);
      const building = entity.getComponent<Building>(Building);

      let visionRange = 7; // 기본 시야
      
      if (unit) {
        const stats = UNIT_STATS[unit.unitType];
        visionRange = stats.visionRange;
        
        // 시즈 모드 탱크는 더 넓은 시야
        if (unit.isSieged) {
          visionRange = stats.siegeRange || visionRange;
        }
      } else if (building) {
        const stats = BUILDING_STATS[building.buildingType];
        visionRange = stats.visionRange;
      }

      this.revealArea(owner.playerId, position.x, position.y, visionRange);
    }
  }

  private revealArea(playerId: number, x: number, y: number, range: number): void {
    const visionMap = this.visionMaps.get(playerId);
    const exploredMap = this.exploredMaps.get(playerId);
    
    if (!visionMap || !exploredMap) return;

    const centerTileX = Math.floor(x / this.tileSize);
    const centerTileY = Math.floor(y / this.tileSize);
    const rangeTiles = range;

    for (let dy = -rangeTiles; dy <= rangeTiles; dy++) {
      for (let dx = -rangeTiles; dx <= rangeTiles; dx++) {
        const tileX = centerTileX + dx;
        const tileY = centerTileY + dy;

        // 맵 경계 체크
        if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
          continue;
        }

        // 원형 시야 체크
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > rangeTiles) continue;

        const index = tileY * this.mapWidth + tileX;
        visionMap[index] = VisibilityState.VISIBLE;
        exploredMap[index] = VisibilityState.EXPLORED;
      }
    }
  }

  // 특정 타일의 가시성 확인
  getVisibility(playerId: number, tileX: number, tileY: number): VisibilityState {
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) {
      return VisibilityState.HIDDEN;
    }

    const index = tileY * this.mapWidth + tileX;
    const visionMap = this.visionMaps.get(playerId);
    const exploredMap = this.exploredMaps.get(playerId);

    if (visionMap && visionMap[index] === VisibilityState.VISIBLE) {
      return VisibilityState.VISIBLE;
    }
    if (exploredMap && exploredMap[index] === VisibilityState.EXPLORED) {
      return VisibilityState.EXPLORED;
    }
    return VisibilityState.HIDDEN;
  }

  // 월드 좌표로 가시성 확인
  getVisibilityAtPosition(playerId: number, x: number, y: number): VisibilityState {
    const tileX = Math.floor(x / this.tileSize);
    const tileY = Math.floor(y / this.tileSize);
    return this.getVisibility(playerId, tileX, tileY);
  }

  // 시야 맵 가져오기 (렌더링용)
  getVisionMap(playerId: number): Uint8Array | undefined {
    return this.visionMaps.get(playerId);
  }

  getExploredMap(playerId: number): Uint8Array | undefined {
    return this.exploredMaps.get(playerId);
  }

  getMapDimensions(): { width: number; height: number; tileSize: number } {
    return {
      width: this.mapWidth,
      height: this.mapHeight,
      tileSize: this.tileSize,
    };
  }
}
