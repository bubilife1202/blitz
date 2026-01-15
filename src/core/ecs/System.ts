// ==========================================
// ECS - System 기반 클래스
// ==========================================
// System은 특정 Component 조합을 가진 Entity들을 처리
// 모든 게임 로직은 System에서 구현

import type { ComponentType } from '@shared/types';
import type { Entity } from './Entity';
import type { GameState } from '../GameState';

export abstract class System {
  // 이 시스템이 처리할 컴포넌트 타입들
  abstract readonly requiredComponents: ComponentType[];

  // 시스템 우선순위 (낮을수록 먼저 실행)
  readonly priority: number = 0;

  // 시스템 활성화 여부
  protected enabled: boolean = true;

  // 매 틱마다 호출 (게임 로직 업데이트)
  abstract update(entities: Entity[], gameState: GameState, deltaTime: number): void;

  // 시스템 초기화 (게임 시작시 한 번)
  init(_gameState: GameState): void {
    // Override if needed
  }

  // 시스템 정리 (게임 종료시)
  cleanup(): void {
    // Override if needed
  }

  // 해당 Entity가 이 시스템의 대상인지 확인
  matchesEntity(entity: Entity): boolean {
    return this.requiredComponents.every(type => 
      entity.getComponentTypes().includes(type)
    );
  }

  // 시스템 활성화/비활성화
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
