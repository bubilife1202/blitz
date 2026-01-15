// ==========================================
// PathfindingService - A* 패스파인딩
// ==========================================

import EasyStar from 'easystarjs';
import type { Vector2, GameConfig } from '@shared/types';

export class PathfindingService {
  private easystar: EasyStar.js;
  private grid: number[][];
  private tileSize: number;
  private mapWidth: number;
  private mapHeight: number;

  constructor(config: GameConfig) {
    this.easystar = new EasyStar.js();
    this.tileSize = config.tileSize;
    this.mapWidth = config.mapWidth;
    this.mapHeight = config.mapHeight;

    // 그리드 초기화 (0 = 이동 가능, 1 = 장애물)
    this.grid = [];
    for (let y = 0; y < this.mapHeight; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.mapWidth; x++) {
        this.grid[y][x] = 0; // 기본적으로 이동 가능
      }
    }

    this.easystar.setGrid(this.grid);
    this.easystar.setAcceptableTiles([0]);
    this.easystar.enableDiagonals();
    this.easystar.enableCornerCutting();
    this.easystar.setIterationsPerCalculation(1000);
  }

  // 픽셀 좌표를 타일 좌표로 변환
  pixelToTile(x: number, y: number): Vector2 {
    return {
      x: Math.floor(x / this.tileSize),
      y: Math.floor(y / this.tileSize),
    };
  }

  // 타일 좌표를 픽셀 좌표로 변환 (타일 중앙)
  tileToPixel(tileX: number, tileY: number): Vector2 {
    return {
      x: tileX * this.tileSize + this.tileSize / 2,
      y: tileY * this.tileSize + this.tileSize / 2,
    };
  }

  // 타일을 장애물로 설정
  setObstacle(tileX: number, tileY: number): void {
    if (this.isValidTile(tileX, tileY)) {
      this.grid[tileY][tileX] = 1;
      this.easystar.setGrid(this.grid);
    }
  }

  // 타일을 이동 가능으로 설정
  clearObstacle(tileX: number, tileY: number): void {
    if (this.isValidTile(tileX, tileY)) {
      this.grid[tileY][tileX] = 0;
      this.easystar.setGrid(this.grid);
    }
  }

  // 타일 유효성 검사
  isValidTile(tileX: number, tileY: number): boolean {
    return tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight;
  }

  // 타일이 이동 가능한지 확인
  isWalkable(tileX: number, tileY: number): boolean {
    if (!this.isValidTile(tileX, tileY)) return false;
    return this.grid[tileY][tileX] === 0;
  }

  // 경로 찾기 (픽셀 좌표 기준)
  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number
  ): Promise<Vector2[]> {
    return new Promise((resolve) => {
      const start = this.pixelToTile(startX, startY);
      const end = this.pixelToTile(endX, endY);

      // 목표 지점이 장애물이면 가장 가까운 이동 가능 타일 찾기
      const adjustedEnd = this.findNearestWalkable(end.x, end.y);
      if (!adjustedEnd) {
        resolve([]);
        return;
      }

      this.easystar.findPath(start.x, start.y, adjustedEnd.x, adjustedEnd.y, (path) => {
        if (path === null || path.length === 0) {
          resolve([]);
        } else {
          // 타일 좌표를 픽셀 좌표로 변환
          const pixelPath = path.map((p) => this.tileToPixel(p.x, p.y));
          resolve(pixelPath);
        }
      });

      this.easystar.calculate();
    });
  }

  // 가장 가까운 이동 가능 타일 찾기
  private findNearestWalkable(tileX: number, tileY: number): Vector2 | null {
    if (this.isWalkable(tileX, tileY)) {
      return { x: tileX, y: tileY };
    }

    // 나선형으로 탐색
    for (let radius = 1; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const nx = tileX + dx;
            const ny = tileY + dy;
            if (this.isWalkable(nx, ny)) {
              return { x: nx, y: ny };
            }
          }
        }
      }
    }

    return null;
  }

  // EasyStar 계산 처리 (매 프레임 호출)
  update(): void {
    this.easystar.calculate();
  }
}
