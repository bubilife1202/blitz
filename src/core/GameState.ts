// ==========================================
// GameState - 중앙 게임 상태 관리
// ==========================================
// 모든 Entity, Player 상태를 관리
// 멀티플레이어 동기화의 핵심

import { Entity } from './ecs/Entity';
import type { System } from './ecs/System';
import { createComponentFromData } from './ComponentFactory';
import type { ComponentType } from '@shared/types';
import type {
  EntityId,
  PlayerId,
  PlayerState,
  Race,
  GameConfig,
  GameSnapshot,
  GameCommand,
  PlayerResources,
} from '@shared/types';
import {
  DEFAULT_GAME_CONFIG,
  INITIAL_MINERALS,
  INITIAL_GAS,
  INITIAL_SUPPLY,
  INITIAL_SUPPLY_MAX,
} from '@shared/constants';

export class GameState {
  // 게임 설정
  public readonly config: GameConfig;
  
  // 현재 틱 (게임 시간)
  private currentTick: number = 0;
  
  // 엔티티 관리
  private entities: Map<EntityId, Entity> = new Map();
  private nextEntityId: EntityId = 1;
  
  // 플레이어 상태
  private players: Map<PlayerId, PlayerState> = new Map();
  
  // 시스템 목록
  private systems: System[] = [];
  
  // 대기 중인 명령 (틱별로 그룹화)
  private pendingCommands: Map<number, GameCommand[]> = new Map();
  
  // 게임 종료 여부
  private gameOver: boolean = false;
  private winnerId: PlayerId | null = null;

  constructor(config: GameConfig = DEFAULT_GAME_CONFIG) {
    this.config = config;
  }

  // ==========================================
  // 틱 관리
  // ==========================================
  
  getCurrentTick(): number {
    return this.currentTick;
  }

  incrementTick(): void {
    this.currentTick++;
  }

  // ==========================================
  // 엔티티 관리
  // ==========================================
  
  createEntity(): Entity {
    const entity = new Entity(this.nextEntityId++);
    this.entities.set(entity.id, entity);
    return entity;
  }

  getEntity(id: EntityId): Entity | undefined {
    return this.entities.get(id);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  removeEntity(id: EntityId): boolean {
    const entity = this.entities.get(id);
    if (entity) {
      entity.destroy();
      return this.entities.delete(id);
    }
    return false;
  }

  // 파괴된 엔티티 정리
  cleanupDestroyedEntities(): void {
    for (const [id, entity] of this.entities) {
      if (entity.isDestroyed()) {
        this.entities.delete(id);
      }
    }
  }

  // ==========================================
  // 플레이어 관리
  // ==========================================
  
  addPlayer(id: PlayerId, race: Race): PlayerState {
    const playerState: PlayerState = {
      id,
      race,
      resources: {
        minerals: INITIAL_MINERALS,
        gas: INITIAL_GAS,
        supply: INITIAL_SUPPLY,
        supplyMax: INITIAL_SUPPLY_MAX,
      },
      isDefeated: false,
      upgrades: [],
    };
    this.players.set(id, playerState);
    return playerState;
  }

  getPlayer(id: PlayerId): PlayerState | undefined {
    return this.players.get(id);
  }

  getAllPlayers(): PlayerState[] {
    return Array.from(this.players.values());
  }

  getPlayerResources(id: PlayerId): PlayerResources | undefined {
    return this.players.get(id)?.resources;
  }

  modifyPlayerResources(id: PlayerId, delta: Partial<PlayerResources>): boolean {
    const player = this.players.get(id);
    if (!player) return false;
    
    if (delta.minerals !== undefined) {
      player.resources.minerals += delta.minerals;
    }
    if (delta.gas !== undefined) {
      player.resources.gas += delta.gas;
    }
    if (delta.supply !== undefined) {
      player.resources.supply += delta.supply;
    }
    if (delta.supplyMax !== undefined) {
      player.resources.supplyMax += delta.supplyMax;
    }
    return true;
  }

  setPlayerDefeated(id: PlayerId, defeated: boolean): void {
    const player = this.players.get(id);
    if (player) {
      player.isDefeated = defeated;
    }
  }

  // ==========================================
  // 시스템 관리
  // ==========================================
  
  addSystem(system: System): void {
    this.systems.push(system);
    // 우선순위로 정렬
    this.systems.sort((a, b) => a.priority - b.priority);
    system.init(this);
  }

  getSystems(): System[] {
    return this.systems;
  }

  // ==========================================
  // 명령 관리
  // ==========================================
  
  queueCommand(command: GameCommand): void {
    const tick = command.tick;
    if (!this.pendingCommands.has(tick)) {
      this.pendingCommands.set(tick, []);
    }
    this.pendingCommands.get(tick)!.push(command);
  }

  getCommandsForTick(tick: number): GameCommand[] {
    return this.pendingCommands.get(tick) || [];
  }

  clearCommandsForTick(tick: number): void {
    this.pendingCommands.delete(tick);
  }

  // ==========================================
  // 게임 종료
  // ==========================================
  
  endGame(winnerId: PlayerId | null): void {
    this.gameOver = true;
    this.winnerId = winnerId;
  }

  isGameOver(): boolean {
    return this.gameOver;
  }

  getWinnerId(): PlayerId | null {
    return this.winnerId;
  }

  // ==========================================
  // 직렬화 (스냅샷)
  // ==========================================
  
  createSnapshot(): GameSnapshot {
    return {
      tick: this.currentTick,
      entities: this.getAllEntities().map(e => e.serialize()),
      players: this.getAllPlayers(),
    };
  }

  // 스냅샷에서 상태 복원
  loadSnapshot(snapshot: GameSnapshot): void {
    this.currentTick = snapshot.tick;
    
    // 기존 엔티티 destroy() 호출 후 클리어
    for (const entity of this.entities.values()) {
      entity.destroy();
    }
    this.entities.clear();
    
    // 엔티티 역직렬화
    for (const entityData of snapshot.entities) {
      const entity = new Entity(entityData.id);
      
      for (const [type, componentData] of Object.entries(entityData.components)) {
        const component = createComponentFromData(type as ComponentType, componentData);
        if (component) {
          entity.addComponent(component);
        }
      }
      
      this.entities.set(entity.id, entity);
      
      // nextEntityId 업데이트
      if (entity.id >= this.nextEntityId) {
        this.nextEntityId = entity.id + 1;
      }
    }
    
    // 플레이어 상태 복원
    this.players.clear();
    for (const playerState of snapshot.players) {
      this.players.set(playerState.id, { ...playerState });
    }
  }

  // 스냅샷을 기존 상태에 반영 (엔티티 재사용)
  applySnapshot(snapshot: GameSnapshot): void {
    this.currentTick = snapshot.tick;

    const seenIds = new Set<EntityId>();

    for (const entityData of snapshot.entities) {
      seenIds.add(entityData.id);
      let entity = this.entities.get(entityData.id);

      if (!entity) {
        entity = new Entity(entityData.id);
        this.entities.set(entityData.id, entity);
      }

      const nextComponentTypes = Object.keys(entityData.components) as ComponentType[];
      const existingTypes = entity.getComponentTypes();

      for (const type of existingTypes) {
        if (!nextComponentTypes.includes(type)) {
          entity.removeComponent({ type } as { type: ComponentType });
        }
      }

      for (const [type, componentData] of Object.entries(entityData.components)) {
        const existingComponent = entity.getComponent({ type } as { type: ComponentType });
        if (existingComponent) {
          existingComponent.deserialize(componentData);
        } else {
          const component = createComponentFromData(type as ComponentType, componentData);
          if (component) {
            entity.addComponent(component);
          }
        }
      }

      if (entity.id >= this.nextEntityId) {
        this.nextEntityId = entity.id + 1;
      }
    }

    for (const [id, entity] of this.entities) {
      if (!seenIds.has(id)) {
        entity.destroy();
        this.entities.delete(id);
      }
    }

    this.players.clear();
    for (const playerState of snapshot.players) {
      this.players.set(playerState.id, { ...playerState });
    }
  }
}
