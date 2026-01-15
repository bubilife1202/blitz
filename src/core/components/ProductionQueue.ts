// ==========================================
// ProductionQueue 컴포넌트 - 생산 대기열
// ==========================================

import { Component } from '../ecs/Component';
import { UnitType } from '@shared/types';

export interface QueueItem {
  unitType: UnitType;
  progress: number; // 0-100
  buildTime: number; // 총 틱 수
}

export interface ProductionQueueData {
  queue: QueueItem[];
  maxQueueSize: number;
}

export class ProductionQueue extends Component {
  static readonly type = 'productionQueue';

  public queue: QueueItem[] = [];
  public maxQueueSize: number = 5;

  constructor(maxQueueSize: number = 5) {
    super();
    this.maxQueueSize = maxQueueSize;
  }

  canQueue(): boolean {
    return this.queue.length < this.maxQueueSize;
  }

  addToQueue(unitType: UnitType, buildTime: number): boolean {
    if (!this.canQueue()) return false;

    this.queue.push({
      unitType,
      progress: 0,
      buildTime,
    });
    return true;
  }

  getCurrentProduction(): QueueItem | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  advanceProduction(tickProgress: number): UnitType | null {
    if (this.queue.length === 0) return null;

    const current = this.queue[0];
    current.progress += (tickProgress / current.buildTime) * 100;

    if (current.progress >= 100) {
      this.queue.shift();
      return current.unitType;
    }

    return null;
  }

  cancelCurrent(): QueueItem | null {
    if (this.queue.length === 0) return null;
    return this.queue.shift() || null;
  }

  cancelLast(): QueueItem | null {
    if (this.queue.length === 0) return null;
    return this.queue.pop() || null;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  serialize(): ProductionQueueData {
    return {
      queue: this.queue.map((q) => ({ ...q })),
      maxQueueSize: this.maxQueueSize,
    };
  }

  deserialize(data: unknown): void {
    const d = data as ProductionQueueData;
    this.queue = d.queue.map((q) => ({ ...q }));
    this.maxQueueSize = d.maxQueueSize;
  }

  clone(): ProductionQueue {
    const p = new ProductionQueue(this.maxQueueSize);
    p.queue = this.queue.map((q) => ({ ...q }));
    return p;
  }
}
