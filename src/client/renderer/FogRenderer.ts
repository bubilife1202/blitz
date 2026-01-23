// ==========================================
// FogRenderer - 안개 전쟁 렌더링
// ==========================================

import Phaser from 'phaser';
import type { VisionSystem } from '@core/systems/VisionSystem';

export class FogRenderer {
  private scene: Phaser.Scene;
  private visionSystem: VisionSystem;
  private playerId: number;
  
  private fogGraphics: Phaser.GameObjects.Graphics;
  private lastUpdate: number = 0;
  private updateInterval: number = 100; // 100ms마다 업데이트

  constructor(scene: Phaser.Scene, visionSystem: VisionSystem, playerId: number = 1) {
    this.scene = scene;
    this.visionSystem = visionSystem;
    this.playerId = playerId;

    this.fogGraphics = scene.add.graphics();
    this.fogGraphics.setDepth(1000); // 유닛 위에 렌더링
  }

  update(): void {
    const now = Date.now();
    if (now - this.lastUpdate < this.updateInterval) return;
    this.lastUpdate = now;

    this.fogGraphics.clear();

    if (this.visionSystem.isRevealAll()) {
      return;
    }

    const visionMap = this.visionSystem.getVisionMap(this.playerId);
    const exploredMap = this.visionSystem.getExploredMap(this.playerId);
    const { width, height, tileSize } = this.visionSystem.getMapDimensions();

    if (!visionMap || !exploredMap) return;

    const showExplored = this.visionSystem.isShowExplored();

    // 카메라 뷰포트 내의 타일만 렌더링
    const camera = this.scene.cameras.main;
    const startTileX = Math.max(0, Math.floor(camera.scrollX / tileSize) - 1);
    const startTileY = Math.max(0, Math.floor(camera.scrollY / tileSize) - 1);
    const endTileX = Math.min(width, Math.ceil((camera.scrollX + camera.width) / tileSize) + 1);
    const endTileY = Math.min(height, Math.ceil((camera.scrollY + camera.height) / tileSize) + 1);

    for (let tileY = startTileY; tileY < endTileY; tileY++) {
      for (let tileX = startTileX; tileX < endTileX; tileX++) {
        const index = tileY * width + tileX;
        const visibility = visionMap[index];
        const explored = exploredMap[index];

        const x = tileX * tileSize;
        const y = tileY * tileSize;

        if (visibility === 2) {
          continue;
        }

        if (showExplored && explored === 1) {
          this.fogGraphics.fillStyle(0x000000, 0.5);
          this.fogGraphics.fillRect(x, y, tileSize, tileSize);
          continue;
        }

        this.fogGraphics.fillStyle(0x000000, 0.95);
        this.fogGraphics.fillRect(x, y, tileSize, tileSize);
      }
    }
  }

  // 특정 엔티티가 보이는지 확인
  isEntityVisible(x: number, y: number): boolean {
    const visibility = this.visionSystem.getVisibilityAtPosition(this.playerId, x, y);
    return visibility === 2; // VISIBLE
  }

  // 특정 엔티티가 탐색되었는지 확인
  isEntityExplored(x: number, y: number): boolean {
    const visibility = this.visionSystem.getVisibilityAtPosition(this.playerId, x, y);
    return visibility >= 1; // EXPLORED or VISIBLE
  }

  destroy(): void {
    this.fogGraphics.destroy();
  }
}
