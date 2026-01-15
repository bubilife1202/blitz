// ==========================================
// Selectable 컴포넌트 - 선택 가능한 엔티티
// ==========================================

import { Component } from '../ecs/Component';

export interface SelectableData {
  isSelected: boolean;
  selectionRadius: number;
}

export class Selectable extends Component {
  static readonly type = 'selectable';

  public isSelected: boolean;
  public selectionRadius: number; // 선택 히트박스 반지름

  constructor(selectionRadius: number = 16) {
    super();
    this.isSelected = false;
    this.selectionRadius = selectionRadius;
  }

  select(): void {
    this.isSelected = true;
  }

  deselect(): void {
    this.isSelected = false;
  }

  toggle(): void {
    this.isSelected = !this.isSelected;
  }

  serialize(): SelectableData {
    return {
      isSelected: this.isSelected,
      selectionRadius: this.selectionRadius,
    };
  }

  deserialize(data: unknown): void {
    const d = data as SelectableData;
    this.isSelected = d.isSelected;
    this.selectionRadius = d.selectionRadius;
  }

  clone(): Selectable {
    const c = new Selectable(this.selectionRadius);
    c.isSelected = this.isSelected;
    return c;
  }
}
