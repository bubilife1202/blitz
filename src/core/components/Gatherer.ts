// ==========================================
// Gatherer 컴포넌트 - 자원 채취 유닛
// ==========================================

import { Component } from '../ecs/Component';
import type { EntityId } from '@shared/types';

export enum GathererState {
  IDLE = 'idle',
  MOVING_TO_RESOURCE = 'moving_to_resource',
  GATHERING = 'gathering',
  RETURNING = 'returning',
}

export interface GathererData {
  state: GathererState;
  targetResourceId: EntityId | null;
  returnBuildingId: EntityId | null;
  carryingAmount: number;
  carryingCapacity: number;
  gatherTimer: number;
}

export class Gatherer extends Component {
  static readonly type = 'gatherer';

  public state: GathererState = GathererState.IDLE;
  public targetResourceId: EntityId | null = null;
  public returnBuildingId: EntityId | null = null;
  public carryingAmount: number = 0;
  public carryingCapacity: number = 8;
  public gatherTimer: number = 0;
  public gatherTime: number = 45; // 틱 (약 3초)

  constructor(capacity: number = 8) {
    super();
    this.carryingCapacity = capacity;
  }

  startGathering(resourceId: EntityId, returnBuildingId: EntityId): void {
    this.state = GathererState.MOVING_TO_RESOURCE;
    this.targetResourceId = resourceId;
    this.returnBuildingId = returnBuildingId;
  }

  isCarryingResources(): boolean {
    return this.carryingAmount > 0;
  }

  isFull(): boolean {
    return this.carryingAmount >= this.carryingCapacity;
  }

  deposit(): number {
    const amount = this.carryingAmount;
    this.carryingAmount = 0;
    return amount;
  }

  stop(): void {
    this.state = GathererState.IDLE;
    this.targetResourceId = null;
    this.gatherTimer = 0;
  }

  serialize(): GathererData {
    return {
      state: this.state,
      targetResourceId: this.targetResourceId,
      returnBuildingId: this.returnBuildingId,
      carryingAmount: this.carryingAmount,
      carryingCapacity: this.carryingCapacity,
      gatherTimer: this.gatherTimer,
    };
  }

  deserialize(data: unknown): void {
    const d = data as GathererData;
    this.state = d.state;
    this.targetResourceId = d.targetResourceId;
    this.returnBuildingId = d.returnBuildingId;
    this.carryingAmount = d.carryingAmount;
    this.carryingCapacity = d.carryingCapacity;
    this.gatherTimer = d.gatherTimer;
  }

  clone(): Gatherer {
    const g = new Gatherer(this.carryingCapacity);
    g.state = this.state;
    g.targetResourceId = this.targetResourceId;
    g.returnBuildingId = this.returnBuildingId;
    g.carryingAmount = this.carryingAmount;
    g.gatherTimer = this.gatherTimer;
    return g;
  }
}
