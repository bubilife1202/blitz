// ==========================================
// ECS - Entity 클래스
// ==========================================
// Entity는 고유 ID + Component 컨테이너
// 로직은 System에서 처리

import type { EntityId, ComponentType } from '@shared/types';
import type { Component } from './Component';

export class Entity {
  public readonly id: EntityId;
  private components: Map<ComponentType, Component> = new Map();
  private destroyed: boolean = false;

  constructor(id: EntityId) {
    this.id = id;
  }

  // 컴포넌트 추가
  addComponent<T extends Component>(component: T): this {
    const type = (component.constructor as typeof Component).type;
    if (!type) {
      throw new Error(`Component ${component.constructor.name} has no type defined`);
    }
    this.components.set(type, component);
    return this;
  }

  // 컴포넌트 가져오기
  getComponent<T extends Component>(componentClass: { type: ComponentType }): T | undefined {
    return this.components.get(componentClass.type) as T | undefined;
  }

  // 컴포넌트 보유 여부
  hasComponent(componentClass: { type: ComponentType }): boolean {
    return this.components.has(componentClass.type);
  }

  // 컴포넌트 제거
  removeComponent(componentClass: { type: ComponentType }): boolean {
    return this.components.delete(componentClass.type);
  }

  // 모든 컴포넌트 가져오기
  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  // 모든 컴포넌트 타입 가져오기
  getComponentTypes(): ComponentType[] {
    return Array.from(this.components.keys());
  }

  // 파괴 표시
  destroy(): void {
    this.destroyed = true;
  }

  // 파괴 여부
  isDestroyed(): boolean {
    return this.destroyed;
  }

  // 직렬화 (멀티플레이어 동기화용)
  serialize(): { id: EntityId; components: Record<ComponentType, unknown> } {
    const components: Record<ComponentType, unknown> = {};
    this.components.forEach((component, type) => {
      components[type] = component.serialize();
    });
    return { id: this.id, components };
  }
}
