// ==========================================
// Owner 컴포넌트 - 플레이어 소유권
// ==========================================

import { Component } from '../ecs/Component';
import type { PlayerId } from '@shared/types';

export interface OwnerData {
  playerId: PlayerId;
}

export class Owner extends Component {
  static readonly type = 'owner';

  public playerId: PlayerId;

  constructor(playerId: PlayerId) {
    super();
    this.playerId = playerId;
  }

  isOwnedBy(playerId: PlayerId): boolean {
    return this.playerId === playerId;
  }

  serialize(): OwnerData {
    return { playerId: this.playerId };
  }

  deserialize(data: unknown): void {
    const d = data as OwnerData;
    this.playerId = d.playerId;
  }

  clone(): Owner {
    return new Owner(this.playerId);
  }
}
