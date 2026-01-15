// ==========================================
// ResearchQueue 컴포넌트 - 업그레이드 연구 큐
// ==========================================

import { Component } from '../ecs/Component';
import { UpgradeType } from '@shared/types';

export interface ResearchItem {
  upgradeType: UpgradeType;
  totalTime: number;
  progress: number; // 0-100
}

export class ResearchQueue extends Component {
  static readonly type = 'researchQueue';

  private currentResearch: ResearchItem | null = null;

  constructor() {
    super();
  }

  startResearch(upgradeType: UpgradeType, buildTime: number): boolean {
    if (this.currentResearch) return false; // 이미 연구 중
    
    this.currentResearch = {
      upgradeType,
      totalTime: buildTime,
      progress: 0,
    };
    return true;
  }

  advanceResearch(tickAmount: number): UpgradeType | null {
    if (!this.currentResearch) return null;

    const progressPerTick = 100 / this.currentResearch.totalTime;
    this.currentResearch.progress += progressPerTick * tickAmount;

    if (this.currentResearch.progress >= 100) {
      const completed = this.currentResearch.upgradeType;
      this.currentResearch = null;
      return completed;
    }

    return null;
  }

  getCurrentResearch(): ResearchItem | null {
    return this.currentResearch;
  }

  isResearching(): boolean {
    return this.currentResearch !== null;
  }

  cancelResearch(): UpgradeType | null {
    if (!this.currentResearch) return null;
    const cancelled = this.currentResearch.upgradeType;
    this.currentResearch = null;
    return cancelled;
  }

  serialize(): { currentResearch: ResearchItem | null } {
    return {
      currentResearch: this.currentResearch,
    };
  }

  deserialize(data: unknown): void {
    const d = data as { currentResearch: ResearchItem | null };
    this.currentResearch = d.currentResearch;
  }

  clone(): ResearchQueue {
    const q = new ResearchQueue();
    if (this.currentResearch) {
      q.currentResearch = { ...this.currentResearch };
    }
    return q;
  }
}
