// ==========================================
// InterpolationBuffer - 클라이언트 보간 시스템
// ==========================================
// 스냅샷 간 위치를 부드럽게 보간하여 순간이동 현상 방지

import type { GameSnapshot, EntityId } from '@shared/types';

interface EntityPosition {
  x: number;
  y: number;
}

// Position component data shape from serialized snapshots
interface PositionData {
  x: number;
  y: number;
}

interface BufferedSnapshot {
  snapshot: GameSnapshot;
  receivedAt: number; // 클라이언트에서 수신한 시간 (ms)
}

export class InterpolationBuffer {
  // 스냅샷 버퍼 (최소 2개 유지)
  private buffer: BufferedSnapshot[] = [];
  
  // 보간 지연 시간 (ms) - 네트워크 지터 흡수용
  private interpolationDelay: number = 100;
  
  // 엔티티별 보간된 위치
  private interpolatedPositions: Map<EntityId, EntityPosition> = new Map();

  constructor(interpolationDelay: number = 100) {
    this.interpolationDelay = interpolationDelay;
  }

  /**
   * 새 스냅샷 추가
   */
  addSnapshot(snapshot: GameSnapshot): void {
    const now = performance.now();
    
    // 이미 같은 틱의 스냅샷이 있으면 무시
    if (this.buffer.some(b => b.snapshot.tick === snapshot.tick)) {
      return;
    }
    
    this.buffer.push({
      snapshot,
      receivedAt: now,
    });
    
    // 틱 순서로 정렬
    this.buffer.sort((a, b) => a.snapshot.tick - b.snapshot.tick);
    
    // 오래된 스냅샷 제거 (최대 5개 유지)
    while (this.buffer.length > 5) {
      this.buffer.shift();
    }
  }

  /**
   * 현재 시간에 맞는 보간된 위치 계산
   */
  interpolate(): Map<EntityId, EntityPosition> {
    const now = performance.now();
    const renderTime = now - this.interpolationDelay;
    
    // 스냅샷이 2개 미만이면 최신 스냅샷 위치 그대로 반환
    if (this.buffer.length < 2) {
      if (this.buffer.length === 1) {
        this.extractPositions(this.buffer[0].snapshot);
      }
      return this.interpolatedPositions;
    }
    
    // renderTime에 해당하는 두 스냅샷 찾기
    let from: BufferedSnapshot | null = null;
    let to: BufferedSnapshot | null = null;
    
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].receivedAt <= renderTime && 
          this.buffer[i + 1].receivedAt >= renderTime) {
        from = this.buffer[i];
        to = this.buffer[i + 1];
        break;
      }
    }
    
    // 적절한 스냅샷 쌍을 찾지 못하면
    if (!from || !to) {
      // renderTime이 모든 스냅샷보다 이전이면 가장 오래된 스냅샷 사용
      if (renderTime < this.buffer[0].receivedAt) {
        this.extractPositions(this.buffer[0].snapshot);
        return this.interpolatedPositions;
      }
      // renderTime이 모든 스냅샷보다 이후면 최신 스냅샷 사용
      this.extractPositions(this.buffer[this.buffer.length - 1].snapshot);
      return this.interpolatedPositions;
    }
    
    // 보간 계수 계산 (0~1)
    const timeDiff = to.receivedAt - from.receivedAt;
    const t = timeDiff > 0 ? (renderTime - from.receivedAt) / timeDiff : 1;
    const clampedT = Math.max(0, Math.min(1, t));
    
    // 두 스냅샷 간 위치 보간
    this.interpolateSnapshots(from.snapshot, to.snapshot, clampedT);
    
    return this.interpolatedPositions;
  }

  /**
   * 스냅샷에서 위치 정보 추출
   */
  private extractPositions(snapshot: GameSnapshot): void {
    this.interpolatedPositions.clear();
    
    for (const entityData of snapshot.entities) {
      const posData = entityData.components.position as PositionData | undefined;
      if (posData) {
        this.interpolatedPositions.set(entityData.id, {
          x: posData.x,
          y: posData.y,
        });
      }
    }
  }

  /**
   * 두 스냅샷 간 위치 보간
   */
  private interpolateSnapshots(
    from: GameSnapshot, 
    to: GameSnapshot, 
    t: number
  ): void {
    this.interpolatedPositions.clear();
    
    // to 스냅샷의 모든 엔티티에 대해 보간
    for (const toEntity of to.entities) {
      const toPosData = toEntity.components.position as PositionData | undefined;
      if (!toPosData) continue;
      
      // from 스냅샷에서 같은 엔티티 찾기
      const fromEntity = from.entities.find(e => e.id === toEntity.id);
      const fromPosData = fromEntity?.components.position as PositionData | undefined;
      
      if (fromPosData) {
        // 선형 보간 (lerp)
        this.interpolatedPositions.set(toEntity.id, {
          x: fromPosData.x + (toPosData.x - fromPosData.x) * t,
          y: fromPosData.y + (toPosData.y - fromPosData.y) * t,
        });
      } else {
        // from에 없는 새 엔티티는 그대로 사용
        this.interpolatedPositions.set(toEntity.id, {
          x: toPosData.x,
          y: toPosData.y,
        });
      }
    }
  }

  /**
   * 특정 엔티티의 보간된 위치 가져오기
   */
  getInterpolatedPosition(entityId: EntityId): EntityPosition | undefined {
    return this.interpolatedPositions.get(entityId);
  }

  /**
   * 최신 스냅샷 가져오기
   */
  getLatestSnapshot(): GameSnapshot | null {
    if (this.buffer.length === 0) return null;
    return this.buffer[this.buffer.length - 1].snapshot;
  }

  /**
   * 버퍼 초기화
   */
  clear(): void {
    this.buffer = [];
    this.interpolatedPositions.clear();
  }

  /**
   * 보간 지연 시간 설정
   */
  setInterpolationDelay(delay: number): void {
    this.interpolationDelay = delay;
  }
}
