// ==========================================
// BuildingPlacer - 건물 배치 시스템
// ==========================================

import Phaser from 'phaser';
import type { GameState } from '@core/GameState';
import type { PathfindingService } from '@core/PathfindingService';

import { Position } from '@core/components/Position';
import { Selectable } from '@core/components/Selectable';
import { Owner } from '@core/components/Owner';
import { Building } from '@core/components/Building';
import { ProductionQueue } from '@core/components/ProductionQueue';
import { ResearchQueue } from '@core/components/ResearchQueue';
import { Resource } from '@core/components/Resource';
import { BuildingType, ResourceType, type PlayerId } from '@shared/types';
import { BUILDING_STATS } from '@shared/constants';

export class BuildingPlacer {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private pathfinding: PathfindingService;
  private localPlayerId: PlayerId;

  // 배치 상태
  private isPlacing: boolean = false;
  private currentBuildingType: BuildingType | null = null;
  
  // 시각적 요소
  private ghostGraphics: Phaser.GameObjects.Graphics | null = null;
  private gridSize: number;

  // 콜백
  public onBuildingPlaced?: (buildingType: BuildingType, x: number, y: number) => void;

  constructor(
    scene: Phaser.Scene,
    gameState: GameState,
    pathfinding: PathfindingService,
    localPlayerId: PlayerId = 1
  ) {
    this.scene = scene;
    this.gameState = gameState;
    this.pathfinding = pathfinding;
    this.localPlayerId = localPlayerId;
    this.gridSize = gameState.config.tileSize;

    this.createGhostGraphics();
  }

  private createGhostGraphics(): void {
    this.ghostGraphics = this.scene.add.graphics();
    this.ghostGraphics.setDepth(1500);
    this.ghostGraphics.setVisible(false);
  }

  // 건물 배치 모드 시작
  startPlacement(buildingType: BuildingType): boolean {
    // 자원 확인
    const stats = BUILDING_STATS[buildingType];
    const resources = this.gameState.getPlayerResources(this.localPlayerId);
    
    if (!resources) return false;
    if (resources.minerals < stats.mineralCost) {
      console.log('Not enough minerals!');
      return false;
    }
    if (resources.gas < stats.gasCost) {
      console.log('Not enough gas!');
      return false;
    }

    this.isPlacing = true;
    this.currentBuildingType = buildingType;
    this.ghostGraphics?.setVisible(true);

    // 마우스 이벤트 등록
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    
    // ESC로 취소
    this.scene.input.keyboard?.once('keydown-ESC', () => {
      this.cancelPlacement();
    });

    return true;
  }

  // 배치 취소
  cancelPlacement(): void {
    this.isPlacing = false;
    this.currentBuildingType = null;
    this.ghostGraphics?.setVisible(false);
    this.ghostGraphics?.clear();
    
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
  }

  // 마우스 이동 핸들러
  private handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (!this.isPlacing || !this.currentBuildingType || !this.ghostGraphics) return;

    // 그리드에 스냅
    const snappedX = Math.floor(pointer.worldX / this.gridSize) * this.gridSize;
    const snappedY = Math.floor(pointer.worldY / this.gridSize) * this.gridSize;

    // 배치 가능 여부 확인
    const isValid = this.checkPlacementValidity(snappedX, snappedY, this.currentBuildingType);

    // 고스트 그리기
    this.drawGhost(snappedX, snappedY, this.currentBuildingType, isValid);
  };

  // 클릭 핸들러
  private handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.isPlacing || !this.currentBuildingType) return;

    if (pointer.leftButtonDown()) {
      const snappedX = Math.floor(pointer.worldX / this.gridSize) * this.gridSize;
      const snappedY = Math.floor(pointer.worldY / this.gridSize) * this.gridSize;

      if (this.checkPlacementValidity(snappedX, snappedY, this.currentBuildingType)) {
        this.placeBuilding(snappedX, snappedY, this.currentBuildingType);
      }
    } else if (pointer.rightButtonDown()) {
      this.cancelPlacement();
    }
  };

  // 고스트 그리기
  private drawGhost(x: number, y: number, buildingType: BuildingType, isValid: boolean): void {
    if (!this.ghostGraphics) return;

    const stats = BUILDING_STATS[buildingType];
    const width = stats.size.width * this.gridSize;
    const height = stats.size.height * this.gridSize;
    const color = isValid ? 0x00ff00 : 0xff0000;
    const alpha = 0.4;

    this.ghostGraphics.clear();
    
    // 배경
    this.ghostGraphics.fillStyle(color, alpha);
    this.ghostGraphics.fillRect(x, y, width, height);
    
    // 테두리
    this.ghostGraphics.lineStyle(2, color, 1);
    this.ghostGraphics.strokeRect(x, y, width, height);

    // 그리드 라인
    this.ghostGraphics.lineStyle(1, color, 0.5);
    for (let i = 1; i < stats.size.width; i++) {
      this.ghostGraphics.lineBetween(x + i * this.gridSize, y, x + i * this.gridSize, y + height);
    }
    for (let j = 1; j < stats.size.height; j++) {
      this.ghostGraphics.lineBetween(x, y + j * this.gridSize, x + width, y + j * this.gridSize);
    }
  }

  // 배치 유효성 검사
  private checkPlacementValidity(x: number, y: number, buildingType: BuildingType): boolean {
    const stats = BUILDING_STATS[buildingType];
    const tileX = Math.floor(x / this.gridSize);
    const tileY = Math.floor(y / this.gridSize);

    // 맵 경계 확인
    if (tileX < 0 || tileY < 0 ||
        tileX + stats.size.width > this.gameState.config.mapWidth ||
        tileY + stats.size.height > this.gameState.config.mapHeight) {
      return false;
    }

    // Refinery는 가스 간헐천 위에만 건설 가능
    if (buildingType === BuildingType.REFINERY) {
      const geyser = this.findGasGeyserAt(x, y);
      if (!geyser) return false;
    }

    // 다른 건물과 겹치는지 확인
    for (const entity of this.gameState.getAllEntities()) {
      const building = entity.getComponent<Building>(Building);
      const position = entity.getComponent<Position>(Position);

      if (!building || !position) continue;

      const bTileX = Math.floor(position.x / this.gridSize);
      const bTileY = Math.floor(position.y / this.gridSize);

      // AABB 충돌 검사
      if (tileX < bTileX + building.width &&
          tileX + stats.size.width > bTileX &&
          tileY < bTileY + building.height &&
          tileY + stats.size.height > bTileY) {
        return false;
      }
    }

    return true;
  }

  // 가스 간헐천 찾기
  private findGasGeyserAt(x: number, y: number): { entity: import('@core/ecs/Entity').Entity; position: Position } | null {
    const checkRadius = this.gridSize * 2; // 2타일 반경 내
    
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

  // 건물 배치
  private placeBuilding(x: number, y: number, buildingType: BuildingType): void {
    const stats = BUILDING_STATS[buildingType];

    // 자원 차감
    this.gameState.modifyPlayerResources(this.localPlayerId, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });

    // 건물 엔티티 생성
    const entity = this.gameState.createEntity();
    const building = new Building(buildingType, false);
    
    // Refinery인 경우 가스 간헐천과 연결
    if (buildingType === BuildingType.REFINERY) {
      const geyser = this.findGasGeyserAt(x, y);
      if (geyser) {
        building.linkedGeyserId = geyser.entity.id;
        // Refinery 위치를 간헐천 위치로 조정
        x = geyser.position.x;
        y = geyser.position.y;
      }
    }
    
    entity
      .addComponent(new Position(x, y))
      .addComponent(new Selectable(32))
      .addComponent(new Owner(this.localPlayerId))
      .addComponent(building);

    // 생산 가능 건물에 ProductionQueue 추가
    if (stats.canProduce && stats.canProduce.length > 0) {
      entity.addComponent(new ProductionQueue(5));
    }

    // 연구 가능 건물에 ResearchQueue 추가
    if (stats.canResearch && stats.canResearch.length > 0) {
      entity.addComponent(new ResearchQueue());
    }

    // 패스파인딩 장애물 등록
    const tileX = Math.floor(x / this.gridSize);
    const tileY = Math.floor(y / this.gridSize);
    for (let dy = 0; dy < stats.size.height; dy++) {
      for (let dx = 0; dx < stats.size.width; dx++) {
        this.pathfinding.setObstacle(tileX + dx, tileY + dy);
      }
    }

    console.log(`Placed ${buildingType} at (${x}, ${y})`);

    // 콜백 호출
    this.onBuildingPlaced?.(buildingType, x, y);

    // 배치 모드 종료
    this.cancelPlacement();
  }

  // 현재 배치 중인지 확인
  isPlacingBuilding(): boolean {
    return this.isPlacing;
  }

  // 현재 배치 중인 건물 타입
  getCurrentBuildingType(): BuildingType | null {
    return this.currentBuildingType;
  }

  // 정리
  destroy(): void {
    this.cancelPlacement();
    this.ghostGraphics?.destroy();
  }
}
