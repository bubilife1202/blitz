// ==========================================
// Builder 컴포넌트 - 건물 건설 유닛 (SCV)
// ==========================================

import { Component } from '../ecs/Component';
import { BuildingType, type EntityId } from '@shared/types';

export enum BuilderState {
  IDLE = 'idle',
  MOVING_TO_BUILD = 'moving_to_build',
  BUILDING = 'building',
}

export interface BuilderData {
  state: BuilderState;
  targetBuildingType: BuildingType | null;
  targetBuildingId: EntityId | null;
  buildX: number | null;
  buildY: number | null;
}

export class Builder extends Component {
  static readonly type = 'builder';

  public state: BuilderState = BuilderState.IDLE;
  public targetBuildingType: BuildingType | null = null;
  public targetBuildingId: EntityId | null = null; // 건설 중인 건물 엔티티 ID
  public buildX: number | null = null;
  public buildY: number | null = null;

  constructor() {
    super();
  }

  // 건설 명령 시작 (SCV가 위치로 이동 시작)
  startBuildCommand(buildingType: BuildingType, x: number, y: number): void {
    this.state = BuilderState.MOVING_TO_BUILD;
    this.targetBuildingType = buildingType;
    this.targetBuildingId = null;
    this.buildX = x;
    this.buildY = y;
  }

  // 건물 건설 시작 (SCV가 위치에 도착 후)
  startBuilding(buildingId: EntityId): void {
    this.state = BuilderState.BUILDING;
    this.targetBuildingId = buildingId;
  }

  // 건설 완료 또는 취소
  finishBuilding(): void {
    this.state = BuilderState.IDLE;
    this.targetBuildingType = null;
    this.targetBuildingId = null;
    this.buildX = null;
    this.buildY = null;
  }

  // 건설 중인지 확인
  isBuilding(): boolean {
    return this.state === BuilderState.BUILDING;
  }

  // 건설하러 이동 중인지 확인
  isMovingToBuild(): boolean {
    return this.state === BuilderState.MOVING_TO_BUILD;
  }

  // 정지 (명령 취소)
  stop(): void {
    this.finishBuilding();
  }

  serialize(): BuilderData {
    return {
      state: this.state,
      targetBuildingType: this.targetBuildingType,
      targetBuildingId: this.targetBuildingId,
      buildX: this.buildX,
      buildY: this.buildY,
    };
  }

  deserialize(data: unknown): void {
    const d = data as BuilderData;
    this.state = d.state;
    this.targetBuildingType = d.targetBuildingType;
    this.targetBuildingId = d.targetBuildingId;
    this.buildX = d.buildX;
    this.buildY = d.buildY;
  }

  clone(): Builder {
    const b = new Builder();
    b.state = this.state;
    b.targetBuildingType = this.targetBuildingType;
    b.targetBuildingId = this.targetBuildingId;
    b.buildX = this.buildX;
    b.buildY = this.buildY;
    return b;
  }
}
