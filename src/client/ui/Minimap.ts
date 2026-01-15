// ==========================================
// Minimap - 미니맵 렌더링
// ==========================================

import Phaser from 'phaser';
import type { GameState } from '@core/GameState';
import type { Entity } from '@core/ecs/Entity';
import { Position } from '@core/components/Position';
import { Owner } from '@core/components/Owner';
import { Unit } from '@core/components/Unit';
import { Building } from '@core/components/Building';
import { Resource } from '@core/components/Resource';

export class Minimap {
  private scene: Phaser.Scene;
  private gameState: GameState;
  private graphics: Phaser.GameObjects.Graphics;
  private container: Phaser.GameObjects.Container;
  private hitArea!: Phaser.GameObjects.Rectangle;

  private x: number;
  private y: number;
  private width: number;
  private height: number;
  private scale: number;

  // 플레이어 색상
  private playerColors: Record<number, number> = {
    1: 0x00ff00, // 초록
    2: 0xff0000, // 빨강
  };

  // 클릭 콜백
  public onMinimapClick?: (worldX: number, worldY: number) => void;

  constructor(
    scene: Phaser.Scene,
    gameState: GameState,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    this.scene = scene;
    this.gameState = gameState;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    const config = gameState.config;
    const mapPixelWidth = config.mapWidth * config.tileSize;
    const mapPixelHeight = config.mapHeight * config.tileSize;
    this.scale = Math.min(width / mapPixelWidth, height / mapPixelHeight);

    this.container = scene.add.container(x, y);
    this.container.setScrollFactor(0);
    this.container.setDepth(3001);

    this.graphics = scene.add.graphics();
    this.container.add(this.graphics);

    this.setupInput();
  }

  private setupInput(): void {
    // 미니맵 클릭 영역 (씬에 직접 추가, 컨테이너 밖)
    this.hitArea = this.scene.add.rectangle(
      this.x + this.width / 2,
      this.y + this.height / 2,
      this.width,
      this.height,
      0x000000,
      0.01
    );
    this.hitArea.setScrollFactor(0);
    this.hitArea.setInteractive({ useHandCursor: true });
    this.hitArea.setDepth(3002);

    // 클릭 및 드래그로 카메라 이동
    this.hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      // 이벤트 전파 중단 (SelectionManager에서 선택 박스 생성 방지)
      event.stopPropagation();
      pointer.event.stopPropagation();
      this.handleMinimapClick(pointer.x, pointer.y);
    });
    
    this.hitArea.on('pointermove', (pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
      if (pointer.isDown) {
        event.stopPropagation();
        this.handleMinimapClick(pointer.x, pointer.y);
      }
    });
  }
  
  private handleMinimapClick(screenX: number, screenY: number): void {
    // 미니맵 내 로컬 좌표 계산
    const localX = screenX - this.x;
    const localY = screenY - this.y;
    
    // 범위 체크
    if (localX < 0 || localX > this.width || localY < 0 || localY > this.height) {
      return;
    }
    
    // 월드 좌표로 변환
    const worldX = localX / this.scale;
    const worldY = localY / this.scale;
    this.onMinimapClick?.(worldX, worldY);
  }

  update(): void {
    this.graphics.clear();

    // 배경 (더 어둡게)
    this.graphics.fillStyle(0x1a1a2e, 1);
    this.graphics.fillRect(0, 0, this.width, this.height);

    // 외곽 테두리 (더 밝게, 두껍게)
    this.graphics.lineStyle(2, 0x666688);
    this.graphics.strokeRect(0, 0, this.width, this.height);
    
    // 내부 테두리
    this.graphics.lineStyle(1, 0x333344);
    this.graphics.strokeRect(2, 2, this.width - 4, this.height - 4);

    // 엔티티 그리기
    const entities = this.gameState.getAllEntities();
    for (const entity of entities) {
      this.drawEntity(entity);
    }

    // 카메라 뷰포트 그리기
    this.drawCameraViewport();
  }

  private drawEntity(entity: Entity): void {
    const position = entity.getComponent<Position>(Position);
    if (!position) return;

    const owner = entity.getComponent<Owner>(Owner);
    const unit = entity.getComponent<Unit>(Unit);
    const building = entity.getComponent<Building>(Building);
    const resource = entity.getComponent<Resource>(Resource);

    const miniX = position.x * this.scale;
    const miniY = position.y * this.scale;

    if (resource) {
      // 자원: 시안색 (미네랄) 또는 초록색 (가스)
      const isGas = resource.resourceType === 'gas';
      this.graphics.fillStyle(isGas ? 0x00ff00 : 0x00ffff, 1);
      this.graphics.fillRect(miniX - 2, miniY - 2, 4, 4);
    } else if (building) {
      // 건물: 큰 사각형 (더 크게)
      const color = owner ? this.playerColors[owner.playerId] || 0xffffff : 0xffffff;
      this.graphics.fillStyle(color, 1);
      const size = building.isConstructing ? 4 : 6;
      this.graphics.fillRect(miniX - size / 2, miniY - size / 2, size, size);
      // 건물 테두리 (더 눈에 띄게)
      this.graphics.lineStyle(1, 0xffffff, 0.5);
      this.graphics.strokeRect(miniX - size / 2, miniY - size / 2, size, size);
    } else if (unit) {
      // 유닛: 점 (더 크게)
      const color = owner ? this.playerColors[owner.playerId] || 0xffffff : 0xffffff;
      this.graphics.fillStyle(color, 1);
      this.graphics.fillCircle(miniX, miniY, 2);
    }
  }

  private drawCameraViewport(): void {
    const camera = this.scene.cameras.main;
    const miniX = camera.scrollX * this.scale;
    const miniY = camera.scrollY * this.scale;
    const miniW = camera.width * this.scale;
    const miniH = camera.height * this.scale;

    this.graphics.lineStyle(1, 0xffffff, 0.8);
    this.graphics.strokeRect(miniX, miniY, miniW, miniH);
  }

  destroy(): void {
    this.hitArea.destroy();
    this.container.destroy();
  }
}
