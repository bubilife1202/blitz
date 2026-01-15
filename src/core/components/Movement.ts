// ==========================================
// Movement 컴포넌트 - 이동 정보
// ==========================================

import { Component } from '../ecs/Component';
import type { Vector2 } from '@shared/types';

export interface MovementData {
  speed: number;
  targetX: number | null;
  targetY: number | null;
  path: Vector2[];
  pathIndex: number;
  isMoving: boolean;
}

export class Movement extends Component {
  static readonly type = 'movement';

  public speed: number; // 초당 픽셀
  public targetX: number | null = null;
  public targetY: number | null = null;
  public path: Vector2[] = []; // A* 경로
  public pathIndex: number = 0;
  public isMoving: boolean = false;

  constructor(speed: number) {
    super();
    this.speed = speed;
  }

  setTarget(x: number, y: number): void {
    this.targetX = x;
    this.targetY = y;
    this.isMoving = true;
  }

  setPath(path: Vector2[]): void {
    this.path = path;
    this.pathIndex = 0;
    if (path.length > 0) {
      this.isMoving = true;
      const first = path[0];
      this.targetX = first.x;
      this.targetY = first.y;
    }
  }

  advanceToNextWaypoint(): boolean {
    this.pathIndex++;
    if (this.pathIndex < this.path.length) {
      const next = this.path[this.pathIndex];
      this.targetX = next.x;
      this.targetY = next.y;
      return true;
    }
    return false;
  }

  stop(): void {
    this.targetX = null;
    this.targetY = null;
    this.path = [];
    this.pathIndex = 0;
    this.isMoving = false;
  }

  hasTarget(): boolean {
    return this.targetX !== null && this.targetY !== null;
  }

  serialize(): MovementData {
    return {
      speed: this.speed,
      targetX: this.targetX,
      targetY: this.targetY,
      path: [...this.path],
      pathIndex: this.pathIndex,
      isMoving: this.isMoving,
    };
  }

  deserialize(data: unknown): void {
    const d = data as MovementData;
    this.speed = d.speed;
    this.targetX = d.targetX;
    this.targetY = d.targetY;
    this.path = [...d.path];
    this.pathIndex = d.pathIndex;
    this.isMoving = d.isMoving;
  }

  clone(): Movement {
    const m = new Movement(this.speed);
    m.targetX = this.targetX;
    m.targetY = this.targetY;
    m.path = [...this.path];
    m.pathIndex = this.pathIndex;
    m.isMoving = this.isMoving;
    return m;
  }
}
