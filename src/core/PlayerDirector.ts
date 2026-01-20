// ==========================================
// PlayerDirector - 감독 모드 AI (플레이어 보조)
// ==========================================

import type { GameState } from './GameState';
import type { Entity } from './ecs/Entity';
import type { PathfindingService } from './PathfindingService';
import { Position } from './components/Position';
import { Owner } from './components/Owner';
import { Unit } from './components/Unit';
import { Building } from './components/Building';
import { Movement } from './components/Movement';
import { Combat } from './components/Combat';
import { Gatherer, GathererState } from './components/Gatherer';
import { ProductionQueue } from './components/ProductionQueue';
import { Builder, BuilderState } from './components/Builder';
import { Resource } from './components/Resource';
import { UnitType, BuildingType, ResourceType, type PlayerId } from '@shared/types';
import { UNIT_STATS, BUILDING_STATS, canTrainUnit } from '@shared/constants';

// 전략 성향
export enum DirectorStance {
  AGGRESSIVE = 'aggressive',  // 빠른 공격, 적은 유닛으로
  BALANCED = 'balanced',      // 균형 잡힌 운영
  DEFENSIVE = 'defensive',    // 방어 우선, 경제 확장
}

// 계획 액션 타입
export interface PlanAction {
  id: string;
  type: 'production' | 'build' | 'attack' | 'gather' | 'expand';
  description: string;
  progress?: number;  // 0-100
  eta?: number;       // 예상 시간 (초)
}

// 승인 필요 항목
export interface ApprovalRequest {
  id: string;
  type: 'attack' | 'expand' | 'tech';
  title: string;
  description: string;
  options: Array<{ id: string; label: string }>;
}

// 로그 항목
export interface DirectorLog {
  timestamp: number;
  message: string;
  type: 'info' | 'action' | 'warning';
}

// 설정
export interface DirectorSettings {
  enabled: boolean;
  stance: DirectorStance;
  autoWorkers: boolean;
  autoProduction: boolean;
  autoSupply: boolean;
}

// 계획 스냅샷 (UI에서 읽어가는 데이터)
export interface PlanSnapshot {
  enabled: boolean;
  stance: DirectorStance;
  nextActions: PlanAction[];
  approvalRequest: ApprovalRequest | null;
  recentLogs: DirectorLog[];
  stats: {
    workers: number;
    army: number;
    buildings: number;
  };
}

export class PlayerDirector {
  private gameState: GameState;
  private _pathfinding: PathfindingService | null = null;
  private playerId: PlayerId;
  
  // 설정
  private settings: DirectorSettings = {
    enabled: false,
    stance: DirectorStance.BALANCED,
    autoWorkers: true,
    autoProduction: true,
    autoSupply: true,
  };
  
  // 계획 상태
  private nextActions: PlanAction[] = [];
  private approvalRequest: ApprovalRequest | null = null;
  private recentLogs: DirectorLog[] = [];
  private maxLogs = 10;
  
  // 타이밍 제어
  private lastUpdateTick = 0;
  private updateInterval = 16; // 매 1초마다 (16틱)
  private lastWorkerCheck = 0;
  private workerCheckInterval = 32; // 2초
  private lastProductionCheck = 0;
  private productionCheckInterval = 24; // 1.5초
  
  // 공격 준비 상태
  private attackReadyThreshold = 6; // 이 수 이상이면 공격 제안
  private lastAttackSuggestionTick = 0;
  private attackSuggestionCooldown = 480; // 30초
  
  // 플레이어 수동 조작 감지 (잠시 손 떼기)
  private lastManualCommandTick = 0;
  private manualCommandCooldown = 48; // 3초간 자동 중지

  constructor(gameState: GameState, playerId: PlayerId, pathfinding?: PathfindingService) {
    this.gameState = gameState;
    this.playerId = playerId;
    this._pathfinding = pathfinding || null;
  }

  setPathfinding(pathfinding: PathfindingService): void {
    this._pathfinding = pathfinding;
  }
  
  getPathfinding(): PathfindingService | null {
    return this._pathfinding;
  }

  // 설정 변경
  setSettings(settings: Partial<DirectorSettings>): void {
    this.settings = { ...this.settings, ...settings };
    if (settings.enabled !== undefined) {
      this.addLog(settings.enabled ? '감독 모드 활성화' : '감독 모드 비활성화', 'info');
    }
    if (settings.stance !== undefined) {
      const stanceNames = {
        [DirectorStance.AGGRESSIVE]: '공격적',
        [DirectorStance.BALANCED]: '균형',
        [DirectorStance.DEFENSIVE]: '방어적',
      };
      this.addLog(`전략 변경: ${stanceNames[settings.stance]}`, 'info');
    }
  }

  getSettings(): DirectorSettings {
    return { ...this.settings };
  }

  // 플레이어 수동 조작 알림 (CommandManager에서 호출)
  notifyManualCommand(): void {
    this.lastManualCommandTick = this.gameState.getCurrentTick();
  }

  // 승인 응답
  respondToApproval(optionId: string): void {
    if (!this.approvalRequest) return;
    
    const request = this.approvalRequest;
    this.approvalRequest = null;
    
    if (request.type === 'attack' && optionId === 'approve') {
      this.launchAttack();
      this.addLog('공격 개시!', 'action');
    } else if (optionId === 'deny') {
      this.addLog('공격 대기', 'info');
      this.lastAttackSuggestionTick = this.gameState.getCurrentTick(); // 쿨다운 리셋
    }
  }

  // 메인 업데이트
  update(): void {
    if (!this.settings.enabled) return;
    
    const currentTick = this.gameState.getCurrentTick();
    
    // 플레이어가 최근 수동 조작했으면 잠시 대기
    if (currentTick - this.lastManualCommandTick < this.manualCommandCooldown) {
      return;
    }
    
    // 메인 업데이트 간격
    if (currentTick - this.lastUpdateTick < this.updateInterval) return;
    this.lastUpdateTick = currentTick;
    
    const resources = this.gameState.getPlayerResources(this.playerId);
    if (!resources) return;
    
    // 계획 액션 초기화
    this.updatePlanActions(resources);
    
    // 자동 행동 실행
    if (this.settings.autoWorkers && currentTick - this.lastWorkerCheck > this.workerCheckInterval) {
      this.manageIdleWorkers();
      this.lastWorkerCheck = currentTick;
    }
    
    if (this.settings.autoProduction && currentTick - this.lastProductionCheck > this.productionCheckInterval) {
      this.manageProduction(resources);
      this.lastProductionCheck = currentTick;
    }
    
    if (this.settings.autoSupply) {
      this.checkSupplyBlock(resources);
    }
    
    // 공격 타이밍 제안
    this.checkAttackTiming(currentTick);
  }

  // 계획 액션 업데이트
  private updatePlanActions(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    this.nextActions = [];
    
    const myBuildings = this.getMyBuildings();
    const myUnits = this.getMyUnits();
    const workers = myUnits.filter(u => u.getComponent<Unit>(Unit)?.unitType === UnitType.SCV);
    const combatUnits = this.getCombatUnits();
    
    // 1. 현재 생산 중인 것들
    for (const building of myBuildings) {
      const queue = building.getComponent<ProductionQueue>(ProductionQueue);
      const buildingComp = building.getComponent<Building>(Building);
      if (!queue || !buildingComp) continue;
      
      const current = queue.getCurrentProduction();
      if (current) {
        this.nextActions.push({
          id: `prod-${building.id}`,
          type: 'production',
          description: `${current.unitType} 생산 중`,
          progress: current.progress,
        });
      }
    }
    
    // 2. 다음 예정 행동
    // 일꾼 부족하면
    if (workers.length < 12 && resources.minerals >= 50) {
      this.nextActions.push({
        id: 'plan-scv',
        type: 'production',
        description: `SCV 생산 예정 (${workers.length}/12)`,
      });
    }
    
    // 서플라이 막힘 임박
    if (resources.supply >= resources.supplyMax - 2) {
      this.nextActions.push({
        id: 'plan-supply',
        type: 'build',
        description: '보급고 건설 필요',
      });
    }
    
    // 공격 준비 상태
    if (combatUnits.length >= this.getAttackThreshold()) {
      this.nextActions.push({
        id: 'plan-attack',
        type: 'attack',
        description: `공격 준비 완료 (${combatUnits.length}기)`,
      });
    }
    
    // 최대 5개
    this.nextActions = this.nextActions.slice(0, 5);
  }

  // Idle 일꾼 자원 채취 배정
  private manageIdleWorkers(): void {
    const idleWorkers = this.getIdleWorkers();
    if (idleWorkers.length === 0) return;
    
    for (const worker of idleWorkers) {
      const pos = worker.getComponent<Position>(Position);
      if (!pos) continue;
      
      const nearestMineral = this.findNearestMineral(pos.x, pos.y);
      if (!nearestMineral) continue;
      
      const mineralPos = nearestMineral.getComponent<Position>(Position);
      if (!mineralPos) continue;
      
      const commandCenter = this.findNearestCommandCenter(pos.x, pos.y);
      if (!commandCenter) continue;
      
      const gatherer = worker.getComponent<Gatherer>(Gatherer);
      const movement = worker.getComponent<Movement>(Movement);
      
      if (gatherer && movement) {
        gatherer.startGathering(nearestMineral.id, commandCenter.id);
        movement.setTarget(mineralPos.x, mineralPos.y);
        this.addLog('유휴 SCV 자원 채취 배정', 'action');
      }
    }
  }

  // 자동 생산
  private manageProduction(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    const myBuildings = this.getMyBuildings();
    const buildingTypes = myBuildings.map(b => b.getComponent<Building>(Building)!.buildingType);
    const workers = this.getMyUnits().filter(u => u.getComponent<Unit>(Unit)?.unitType === UnitType.SCV);
    
    for (const building of myBuildings) {
      const buildingComp = building.getComponent<Building>(Building)!;
      const queue = building.getComponent<ProductionQueue>(ProductionQueue);
      
      if (!queue || buildingComp.isConstructing) continue;
      if (!queue.canQueue()) continue;
      
      // 커맨드센터: SCV (12기까지)
      if (buildingComp.buildingType === BuildingType.COMMAND_CENTER) {
        if (workers.length < 12 && this.canAfford(UnitType.SCV, resources)) {
          this.trainUnit(queue, UnitType.SCV);
          this.addLog('SCV 생산 시작', 'action');
        }
      }
      
      // 배럭: 마린 (전략에 따라 속도 조절)
      if (buildingComp.buildingType === BuildingType.BARRACKS) {
        if (this.canAfford(UnitType.MARINE, resources) && canTrainUnit(UnitType.MARINE, buildingTypes)) {
          // 공격적: 빠른 생산, 방어적: 경제 우선
          const combatUnits = this.getCombatUnits().length;
          const maxUnits = this.settings.stance === DirectorStance.AGGRESSIVE ? 20 : 
                          this.settings.stance === DirectorStance.DEFENSIVE ? 8 : 12;
          
          if (combatUnits < maxUnits) {
            this.trainUnit(queue, UnitType.MARINE);
            this.addLog('마린 생산 시작', 'action');
          }
        }
      }
      
      // 팩토리: Vulture/Tank (자원 여유시)
      if (buildingComp.buildingType === BuildingType.FACTORY) {
        if (this.canAfford(UnitType.VULTURE, resources) && canTrainUnit(UnitType.VULTURE, buildingTypes)) {
          this.trainUnit(queue, UnitType.VULTURE);
          this.addLog('벌처 생산 시작', 'action');
        } else if (this.canAfford(UnitType.SIEGE_TANK, resources) && canTrainUnit(UnitType.SIEGE_TANK, buildingTypes)) {
          this.trainUnit(queue, UnitType.SIEGE_TANK);
          this.addLog('시즈탱크 생산 시작', 'action');
        }
      }
    }
  }

  // 서플라이 막힘 체크 및 건설
  private checkSupplyBlock(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    if (resources.supply < resources.supplyMax - 2) return;
    if (resources.minerals < BUILDING_STATS[BuildingType.SUPPLY_DEPOT].mineralCost) return;
    
    // 이미 건설 중인 서플라이 디포 있는지 체크
    const constructingDepot = this.getMyBuildings().find(b => {
      const building = b.getComponent<Building>(Building);
      return building?.buildingType === BuildingType.SUPPLY_DEPOT && building.isConstructing;
    });
    if (constructingDepot) return;
    
    // 건설 중인 SCV 있는지 체크
    const buildingSCV = this.getMyUnits().find(u => {
      const builder = u.getComponent<Builder>(Builder);
      return builder && builder.state !== BuilderState.IDLE;
    });
    if (buildingSCV) return;
    
    // Idle SCV로 보급고 건설
    const idleWorkers = this.getIdleWorkers();
    if (idleWorkers.length === 0) return;
    
    const worker = idleWorkers[0];
    const buildPos = this.findBuildLocation(BuildingType.SUPPLY_DEPOT);
    if (!buildPos) return;
    
    // 자원 차감
    this.gameState.modifyPlayerResources(this.playerId, {
      minerals: -BUILDING_STATS[BuildingType.SUPPLY_DEPOT].mineralCost,
    });
    
    // Builder 컴포넌트로 건설 명령
    const builder = worker.getComponent<Builder>(Builder);
    const gatherer = worker.getComponent<Gatherer>(Gatherer);
    const movement = worker.getComponent<Movement>(Movement);
    
    if (builder && movement) {
      builder.startBuildCommand(BuildingType.SUPPLY_DEPOT, buildPos.x, buildPos.y);
      movement.setTarget(buildPos.x, buildPos.y);
      if (gatherer) gatherer.stop();
      this.addLog('보급고 건설 시작', 'action');
    }
  }

  // 공격 타이밍 제안
  private checkAttackTiming(currentTick: number): void {
    if (this.approvalRequest) return; // 이미 승인 대기 중
    if (currentTick - this.lastAttackSuggestionTick < this.attackSuggestionCooldown) return;
    
    const combatUnits = this.getCombatUnits();
    const threshold = this.getAttackThreshold();
    
    if (combatUnits.length >= threshold) {
      this.approvalRequest = {
        id: `attack-${currentTick}`,
        type: 'attack',
        title: '공격 준비 완료',
        description: `전투 유닛 ${combatUnits.length}기가 준비되었습니다. 공격할까요?`,
        options: [
          { id: 'approve', label: '공격!' },
          { id: 'deny', label: '대기' },
        ],
      };
      this.lastAttackSuggestionTick = currentTick;
    }
  }

  // 전략에 따른 공격 임계값
  private getAttackThreshold(): number {
    switch (this.settings.stance) {
      case DirectorStance.AGGRESSIVE: return 4;
      case DirectorStance.DEFENSIVE: return 10;
      default: return this.attackReadyThreshold;
    }
  }

  // 공격 실행
  private launchAttack(): void {
    const combatUnits = this.getCombatUnits();
    const enemies = this.getEnemyEntities();
    
    if (enemies.length === 0 || combatUnits.length === 0) return;
    
    // 적 건물 우선 타겟
    const target = this.findPriorityTarget(enemies);
    if (!target) return;
    
    const targetPos = target.getComponent<Position>(Position);
    if (!targetPos) return;
    
    for (const unit of combatUnits) {
      const movement = unit.getComponent<Movement>(Movement);
      const combat = unit.getComponent<Combat>(Combat);
      
      if (movement && combat) {
        combat.startAttackMove(targetPos.x, targetPos.y);
        movement.setTarget(targetPos.x, targetPos.y);
      }
    }
  }

  // 계획 스냅샷 (UI용)
  getPlanSnapshot(): PlanSnapshot {
    const workers = this.getMyUnits().filter(u => u.getComponent<Unit>(Unit)?.unitType === UnitType.SCV).length;
    const army = this.getCombatUnits().length;
    const buildings = this.getMyBuildings().length;
    
    return {
      enabled: this.settings.enabled,
      stance: this.settings.stance,
      nextActions: [...this.nextActions],
      approvalRequest: this.approvalRequest,
      recentLogs: [...this.recentLogs],
      stats: { workers, army, buildings },
    };
  }

  // 로그 추가
  private addLog(message: string, type: DirectorLog['type']): void {
    this.recentLogs.unshift({
      timestamp: Date.now(),
      message,
      type,
    });
    if (this.recentLogs.length > this.maxLogs) {
      this.recentLogs.pop();
    }
  }

  // ==========================================
  // 헬퍼 메서드
  // ==========================================

  private canAfford(unitType: UnitType, resources: { minerals: number; gas: number; supply: number; supplyMax: number }): boolean {
    const stats = UNIT_STATS[unitType];
    return resources.minerals >= stats.mineralCost &&
           resources.gas >= stats.gasCost &&
           resources.supply + stats.supplyCost <= resources.supplyMax;
  }

  private trainUnit(queue: ProductionQueue, unitType: UnitType): void {
    const stats = UNIT_STATS[unitType];
    queue.addToQueue(unitType, stats.buildTime);
    this.gameState.modifyPlayerResources(this.playerId, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
  }

  private getIdleWorkers(): Entity[] {
    return this.getMyUnits().filter(u => {
      const unit = u.getComponent<Unit>(Unit);
      const gatherer = u.getComponent<Gatherer>(Gatherer);
      const builder = u.getComponent<Builder>(Builder);
      const movement = u.getComponent<Movement>(Movement);
      
      if (unit?.unitType !== UnitType.SCV) return false;
      if (gatherer?.state !== GathererState.IDLE) return false;
      if (builder?.state !== BuilderState.IDLE) return false;
      if (movement?.isMoving) return false;
      
      return true;
    });
  }

  private getCombatUnits(): Entity[] {
    return this.getMyUnits().filter(u => {
      const unit = u.getComponent<Unit>(Unit);
      return unit && unit.unitType !== UnitType.SCV;
    });
  }

  private getMyUnits(): Entity[] {
    return this.gameState.getAllEntities().filter(e => {
      const owner = e.getComponent<Owner>(Owner);
      const unit = e.getComponent<Unit>(Unit);
      return owner?.playerId === this.playerId && unit && !e.isDestroyed();
    });
  }

  private getMyBuildings(): Entity[] {
    return this.gameState.getAllEntities().filter(e => {
      const owner = e.getComponent<Owner>(Owner);
      const building = e.getComponent<Building>(Building);
      return owner?.playerId === this.playerId && building && !e.isDestroyed();
    });
  }

  private getEnemyEntities(): Entity[] {
    return this.gameState.getAllEntities().filter(e => {
      const owner = e.getComponent<Owner>(Owner);
      return owner && owner.playerId !== this.playerId && !e.isDestroyed();
    });
  }

  private findNearestMineral(x: number, y: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;
    
    for (const entity of this.gameState.getAllEntities()) {
      const resource = entity.getComponent<Resource>(Resource);
      const position = entity.getComponent<Position>(Position);
      
      if (!resource || !position || resource.isDepleted()) continue;
      if (resource.resourceType !== ResourceType.MINERALS) continue;
      
      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = entity;
      }
    }
    
    return nearest;
  }

  private findNearestCommandCenter(x: number, y: number): Entity | null {
    let nearest: Entity | null = null;
    let nearestDist = Infinity;
    
    for (const building of this.getMyBuildings()) {
      const buildingComp = building.getComponent<Building>(Building);
      const position = building.getComponent<Position>(Position);
      
      if (!buildingComp || !position) continue;
      if (buildingComp.buildingType !== BuildingType.COMMAND_CENTER) continue;
      if (buildingComp.isConstructing) continue;
      
      const dist = Math.sqrt(Math.pow(x - position.x, 2) + Math.pow(y - position.y, 2));
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = building;
      }
    }
    
    return nearest;
  }

  private findBuildLocation(buildingType: BuildingType): { x: number; y: number } | null {
    const stats = BUILDING_STATS[buildingType];
    const tileSize = this.gameState.config.tileSize;
    
    const commandCenter = this.getMyBuildings().find(b => 
      b.getComponent<Building>(Building)?.buildingType === BuildingType.COMMAND_CENTER
    );
    
    if (!commandCenter) return null;
    
    const ccPos = commandCenter.getComponent<Position>(Position);
    if (!ccPos) return null;
    
    const baseTileX = Math.floor(ccPos.x / tileSize);
    const baseTileY = Math.floor(ccPos.y / tileSize);
    
    for (let radius = 3; radius < 15; radius++) {
      for (let angle = 0; angle < 8; angle++) {
        const offsetX = Math.round(Math.cos(angle * Math.PI / 4) * radius);
        const offsetY = Math.round(Math.sin(angle * Math.PI / 4) * radius);
        
        const tileX = baseTileX + offsetX;
        const tileY = baseTileY + offsetY;
        
        if (this.canPlaceBuilding(tileX, tileY, stats.size.width, stats.size.height)) {
          return {
            x: tileX * tileSize + (stats.size.width * tileSize) / 2,
            y: tileY * tileSize + (stats.size.height * tileSize) / 2,
          };
        }
      }
    }
    
    return null;
  }

  private canPlaceBuilding(tileX: number, tileY: number, width: number, height: number): boolean {
    const config = this.gameState.config;
    
    if (tileX < 1 || tileY < 1 || 
        tileX + width >= config.mapWidth - 1 || 
        tileY + height >= config.mapHeight - 1) {
      return false;
    }
    
    for (const entity of this.gameState.getAllEntities()) {
      const building = entity.getComponent<Building>(Building);
      const position = entity.getComponent<Position>(Position);
      
      if (!building || !position) continue;
      
      const bTileX = Math.floor(position.x / config.tileSize) - Math.floor(building.width / 2);
      const bTileY = Math.floor(position.y / config.tileSize) - Math.floor(building.height / 2);
      
      if (tileX < bTileX + building.width + 1 &&
          tileX + width + 1 > bTileX &&
          tileY < bTileY + building.height + 1 &&
          tileY + height + 1 > bTileY) {
        return false;
      }
    }
    
    for (const entity of this.gameState.getAllEntities()) {
      const resource = entity.getComponent<Resource>(Resource);
      const position = entity.getComponent<Position>(Position);
      
      if (!resource || !position) continue;
      
      const rTileX = Math.floor(position.x / config.tileSize);
      const rTileY = Math.floor(position.y / config.tileSize);
      
      if (tileX <= rTileX + 1 && tileX + width >= rTileX &&
          tileY <= rTileY + 1 && tileY + height >= rTileY) {
        return false;
      }
    }
    
    return true;
  }

  private findPriorityTarget(enemies: Entity[]): Entity | null {
    const buildings = enemies.filter(e => e.getComponent<Building>(Building));
    const units = enemies.filter(e => e.getComponent<Unit>(Unit));
    
    const productionBuildings = buildings.filter(b => {
      const building = b.getComponent<Building>(Building);
      return building && [BuildingType.BARRACKS, BuildingType.FACTORY, BuildingType.COMMAND_CENTER].includes(building.buildingType);
    });
    
    if (productionBuildings.length > 0) {
      return productionBuildings[0];
    }
    
    if (buildings.length > 0) {
      return buildings[0];
    }
    
    return units.length > 0 ? units[0] : null;
  }
}
