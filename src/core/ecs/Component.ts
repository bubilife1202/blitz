// ==========================================
// ECS - Component 기반 클래스
// ==========================================
// Component는 순수 데이터만 보유 (로직 없음)
// 렌더링과 무관한 게임 상태만 저장

import type { ComponentType } from '@shared/types';

export abstract class Component {
  // 각 컴포넌트 클래스는 고유한 타입 이름을 가짐
  static readonly type: ComponentType;
  
  // 직렬화 (멀티플레이어 동기화용)
  abstract serialize(): unknown;
  
  // 역직렬화
  abstract deserialize(data: unknown): void;
  
  // 복제 (스냅샷용)
  abstract clone(): Component;
}
