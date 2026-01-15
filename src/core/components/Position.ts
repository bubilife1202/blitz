// ==========================================
// Position 컴포넌트 - 엔티티 위치
// ==========================================

import { Component } from '../ecs/Component';
import type { Vector2 } from '@shared/types';

export class Position extends Component {
  static readonly type = 'position';

  public x: number;
  public y: number;

  constructor(x: number = 0, y: number = 0) {
    super();
    this.x = x;
    this.y = y;
  }

  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }

  getVector(): Vector2 {
    return { x: this.x, y: this.y };
  }

  distanceTo(other: Position): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  serialize(): Vector2 {
    return { x: this.x, y: this.y };
  }

  deserialize(data: unknown): void {
    const pos = data as Vector2;
    this.x = pos.x;
    this.y = pos.y;
  }

  clone(): Position {
    return new Position(this.x, this.y);
  }
}
