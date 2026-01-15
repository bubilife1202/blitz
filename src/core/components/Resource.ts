// ==========================================
// Resource 컴포넌트 - 자원 노드 (미네랄/가스)
// ==========================================

import { Component } from '../ecs/Component';
import { ResourceType } from '@shared/types';

export interface ResourceData {
  resourceType: ResourceType;
  amount: number;
  maxAmount: number;
  gatherRate: number;
}

export class Resource extends Component {
  static readonly type = 'resource';

  public resourceType: ResourceType;
  public amount: number;
  public maxAmount: number;
  public gatherRate: number; // 틱당 채취량

  constructor(resourceType: ResourceType, amount: number, gatherRate: number) {
    super();
    this.resourceType = resourceType;
    this.amount = amount;
    this.maxAmount = amount;
    this.gatherRate = gatherRate;
  }

  gather(workerCount: number = 1): number {
    const gathered = Math.min(this.amount, this.gatherRate * workerCount);
    this.amount -= gathered;
    return gathered;
  }

  isDepleted(): boolean {
    return this.amount <= 0;
  }

  getPercentage(): number {
    return this.amount / this.maxAmount;
  }

  serialize(): ResourceData {
    return {
      resourceType: this.resourceType,
      amount: this.amount,
      maxAmount: this.maxAmount,
      gatherRate: this.gatherRate,
    };
  }

  deserialize(data: unknown): void {
    const d = data as ResourceData;
    this.resourceType = d.resourceType;
    this.amount = d.amount;
    this.maxAmount = d.maxAmount;
    this.gatherRate = d.gatherRate;
  }

  clone(): Resource {
    const r = new Resource(this.resourceType, this.amount, this.gatherRate);
    r.maxAmount = this.maxAmount;
    return r;
  }
}
