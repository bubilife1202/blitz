export interface Poolable {
  reset(): void;
}

export class ObjectPool<T extends Poolable> {
  private pool: T[] = [];
  private factory: () => T;
  private maxSize: number;
  private activeCount = 0;

  constructor(factory: () => T, initialSize = 0, maxSize = 1000) {
    this.factory = factory;
    this.maxSize = maxSize;

    for (let i = 0; i < initialSize; i++) {
      this.pool.push(factory());
    }
  }

  acquire(): T {
    let obj: T;
    
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.factory();
    }
    
    this.activeCount++;
    return obj;
  }

  release(obj: T): void {
    if (this.pool.length < this.maxSize) {
      obj.reset();
      this.pool.push(obj);
    }
    this.activeCount--;
  }

  releaseAll(objects: T[]): void {
    for (const obj of objects) {
      this.release(obj);
    }
  }

  prewarm(count: number): void {
    const toCreate = Math.min(count, this.maxSize) - this.pool.length;
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.factory());
    }
  }

  clear(): void {
    this.pool = [];
    this.activeCount = 0;
  }

  getStats(): { pooled: number; active: number; maxSize: number } {
    return {
      pooled: this.pool.length,
      active: this.activeCount,
      maxSize: this.maxSize,
    };
  }
}

export class VectorPool {
  private pool: { x: number; y: number }[] = [];
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  acquire(x = 0, y = 0): { x: number; y: number } {
    if (this.pool.length > 0) {
      const v = this.pool.pop()!;
      v.x = x;
      v.y = y;
      return v;
    }
    return { x, y };
  }

  release(v: { x: number; y: number }): void {
    if (this.pool.length < this.maxSize) {
      this.pool.push(v);
    }
  }
}

export const vectorPool = new VectorPool();
