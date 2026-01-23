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
import { UNIT_STATS, BUILDING_STATS, canBuildBuilding, canTrainUnit } from '@shared/constants';

// 전략 성향 (deprecated - Strategy로 대체)
export enum DirectorStance {
  AGGRESSIVE = 'aggressive',  // 빠른 공격, 적은 유닛으로
  BALANCED = 'balanced',      // 균형 잡힌 운영
  DEFENSIVE = 'defensive',    // 방어 우선, 경제 확장
}

// ==========================================
// 전략 시스템 (Strategy)
// ==========================================

// 유닛 자동생산 설정
export interface UnitProductionConfig {
  unitType: UnitType;
  enabled: boolean;        // 자동생산 ON/OFF
  targetCount: number;     // 목표 수 (0 = 무제한)
  priority: number;        // 우선순위 (높을수록 먼저)
}

// 빌드 오더 아이템
export interface BuildOrderItem {
  buildingType: BuildingType;
  triggerType: 'supply' | 'minerals' | 'time' | 'building';
  triggerValue: number;    // 서플라이 N, 미네랄 N, 시간 N초, 건물 N개
  triggerBuilding?: BuildingType; // building 트리거일 때 어떤 건물 후에
  completed?: boolean;
}

// 전략 타입
export interface Strategy {
  id: string;
  name: string;
  description: string;
  isCustom: boolean;
  
  // 유닛 자동생산 설정
  unitProduction: UnitProductionConfig[];
  
  // 빌드 오더 (순서대로 실행)
  buildOrder: BuildOrderItem[];
  
  // 파라미터
  workerTarget: number;           // 목표 일꾼 수
  attackThreshold: number;        // 공격 시작 유닛 수
  expandMineralThreshold: number; // 확장 시작 미네랄
  gasTimingWorkers: number;       // 가스 채취 시작 일꾼 수 (0 = 즉시)
  
  // 자동 행동 ON/OFF
  autoSupply: boolean;            // 자동 서플라이 건설
  autoExpand: boolean;            // 자동 확장 제안
  autoAttack: boolean;            // 자동 공격 제안
}

// 기본 프리셋 전략들
export const PRESET_STRATEGIES: Strategy[] = [
  {
    id: 'balanced',
    name: '균형',
    description: '안정적인 경제와 병력 균형',
    isCustom: false,
    unitProduction: [
      { unitType: UnitType.SCV, enabled: true, targetCount: 12, priority: 10 },
      { unitType: UnitType.MARINE, enabled: true, targetCount: 12, priority: 5 },
      { unitType: UnitType.VULTURE, enabled: false, targetCount: 4, priority: 3 },
      { unitType: UnitType.SIEGE_TANK, enabled: false, targetCount: 2, priority: 4 },
      { unitType: UnitType.FIREBAT, enabled: false, targetCount: 0, priority: 2 },
      { unitType: UnitType.MEDIC, enabled: false, targetCount: 2, priority: 3 },
      { unitType: UnitType.GOLIATH, enabled: false, targetCount: 0, priority: 2 },
    ],
    buildOrder: [
      { buildingType: BuildingType.SUPPLY_DEPOT, triggerType: 'supply', triggerValue: 9 },
      { buildingType: BuildingType.BARRACKS, triggerType: 'supply', triggerValue: 10 },
      { buildingType: BuildingType.REFINERY, triggerType: 'supply', triggerValue: 12 },
      { buildingType: BuildingType.SUPPLY_DEPOT, triggerType: 'supply', triggerValue: 15 },
    ],
    workerTarget: 12,
    attackThreshold: 6,
    expandMineralThreshold: 400,
    gasTimingWorkers: 10,
    autoSupply: true,
    autoExpand: true,
    autoAttack: true,
  },
  {
    id: 'marine_rush',
    name: '마린 러시',
    description: '빠른 배럭 2개로 마린 물량 공격',
    isCustom: false,
    unitProduction: [
      { unitType: UnitType.SCV, enabled: true, targetCount: 10, priority: 8 },
      { unitType: UnitType.MARINE, enabled: true, targetCount: 20, priority: 10 },
      { unitType: UnitType.VULTURE, enabled: false, targetCount: 0, priority: 1 },
      { unitType: UnitType.SIEGE_TANK, enabled: false, targetCount: 0, priority: 1 },
      { unitType: UnitType.FIREBAT, enabled: false, targetCount: 0, priority: 1 },
      { unitType: UnitType.MEDIC, enabled: false, targetCount: 0, priority: 1 },
      { unitType: UnitType.GOLIATH, enabled: false, targetCount: 0, priority: 1 },
    ],
    buildOrder: [
      { buildingType: BuildingType.SUPPLY_DEPOT, triggerType: 'supply', triggerValue: 9 },
      { buildingType: BuildingType.BARRACKS, triggerType: 'supply', triggerValue: 10 },
      { buildingType: BuildingType.BARRACKS, triggerType: 'minerals', triggerValue: 150 },
      { buildingType: BuildingType.SUPPLY_DEPOT, triggerType: 'supply', triggerValue: 14 },
    ],
    workerTarget: 10,
    attackThreshold: 4,
    expandMineralThreshold: 600,
    gasTimingWorkers: 0, // 가스 안함
    autoSupply: true,
    autoExpand: false,
    autoAttack: true,
  },
  {
    id: 'fast_factory',
    name: '빠른 팩토리',
    description: '빠르게 가스 → 팩토리 → 탱크/벌처',
    isCustom: false,
    unitProduction: [
      { unitType: UnitType.SCV, enabled: true, targetCount: 14, priority: 10 },
      { unitType: UnitType.MARINE, enabled: true, targetCount: 4, priority: 3 },
      { unitType: UnitType.VULTURE, enabled: true, targetCount: 6, priority: 7 },
      { unitType: UnitType.SIEGE_TANK, enabled: true, targetCount: 4, priority: 8 },
      { unitType: UnitType.FIREBAT, enabled: false, targetCount: 0, priority: 1 },
      { unitType: UnitType.MEDIC, enabled: false, targetCount: 0, priority: 1 },
      { unitType: UnitType.GOLIATH, enabled: false, targetCount: 0, priority: 1 },
    ],
    buildOrder: [
      { buildingType: BuildingType.SUPPLY_DEPOT, triggerType: 'supply', triggerValue: 9 },
      { buildingType: BuildingType.BARRACKS, triggerType: 'supply', triggerValue: 10 },
      { buildingType: BuildingType.REFINERY, triggerType: 'supply', triggerValue: 11 },
      { buildingType: BuildingType.FACTORY, triggerType: 'minerals', triggerValue: 200 },
      { buildingType: BuildingType.SUPPLY_DEPOT, triggerType: 'supply', triggerValue: 16 },
    ],
    workerTarget: 14,
    attackThreshold: 8,
    expandMineralThreshold: 400,
    gasTimingWorkers: 8,
    autoSupply: true,
    autoExpand: true,
    autoAttack: true,
  },
  {
    id: 'safe_expand',
    name: '안정 확장',
    description: '경제 우선, 방어적 플레이 후 확장',
    isCustom: false,
    unitProduction: [
      { unitType: UnitType.SCV, enabled: true, targetCount: 20, priority: 10 },
      { unitType: UnitType.MARINE, enabled: true, targetCount: 8, priority: 5 },
      { unitType: UnitType.VULTURE, enabled: false, targetCount: 0, priority: 1 },
      { unitType: UnitType.SIEGE_TANK, enabled: true, targetCount: 2, priority: 6 },
      { unitType: UnitType.FIREBAT, enabled: false, targetCount: 0, priority: 1 },
      { unitType: UnitType.MEDIC, enabled: true, targetCount: 2, priority: 4 },
      { unitType: UnitType.GOLIATH, enabled: false, targetCount: 0, priority: 1 },
    ],
    buildOrder: [
      { buildingType: BuildingType.SUPPLY_DEPOT, triggerType: 'supply', triggerValue: 9 },
      { buildingType: BuildingType.BARRACKS, triggerType: 'supply', triggerValue: 10 },
      { buildingType: BuildingType.REFINERY, triggerType: 'supply', triggerValue: 12 },
      { buildingType: BuildingType.BUNKER, triggerType: 'minerals', triggerValue: 100 },
      { buildingType: BuildingType.COMMAND_CENTER, triggerType: 'minerals', triggerValue: 400 },
      { buildingType: BuildingType.FACTORY, triggerType: 'minerals', triggerValue: 200 },
    ],
    workerTarget: 20,
    attackThreshold: 12,
    expandMineralThreshold: 300,
    gasTimingWorkers: 10,
    autoSupply: true,
    autoExpand: true,
    autoAttack: true,
  },
];

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
  stance: DirectorStance; // deprecated, Strategy로 대체
  strategyId: string;     // 현재 선택된 전략 ID
  autoWorkers: boolean;
  autoProduction: boolean;
  autoSupply: boolean;
}

// 계획 스냅샷 (UI에서 읽어가는 데이터)
export interface PlanSnapshot {
  enabled: boolean;
  stance: DirectorStance;
  currentStrategy: Strategy;
  availableStrategies: Strategy[];
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
    strategyId: 'balanced',
    autoWorkers: true,
    autoProduction: true,
    autoSupply: true,
  };
  
  // 전략 목록 (프리셋 + 커스텀)
  private strategies: Strategy[] = [...PRESET_STRATEGIES];
  private currentStrategy: Strategy = PRESET_STRATEGIES[0];
  
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
  
  // 공격 제안 쿨다운
  private lastAttackSuggestionTick = 0;
  private attackSuggestionCooldown = 240; // 15초 (더 빠르게)
  
  // 다양한 제안 쿨다운
  private lastExpandSuggestionTick = 0;
  private expandSuggestionCooldown = 320; // 20초
  private lastTechSuggestionTick = 0;
  private techSuggestionCooldown = 400; // 25초
  private lastDefenseSuggestionTick = 0;
  private defenseSuggestionCooldown = 160; // 10초
  
  // 이벤트 감지
  private lastArmyCount = 0;
  private lastEnemyCheckTick = 0;
  private enemyCheckInterval = 32; // 2초마다 적 체크
  private lastEnemySeenTick = 0;
  private lastIntelConfidence = 0.6;
  private enemyLastSeen: Map<number, number> = new Map();
  private intelDecayWindow = 640;
  private intelMinConfidence = 0.2;
  
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

  // 전략 선택
  selectStrategy(strategyId: string): void {
    const strategy = this.strategies.find(s => s.id === strategyId);
    if (strategy) {
      this.currentStrategy = strategy;
      this.settings.strategyId = strategyId;
      this.addLog(`전략 변경: ${strategy.name}`, 'info');
      
      // 빌드오더 초기화
      for (const item of strategy.buildOrder) {
        item.completed = false;
      }
    }
  }

  // 전략 추가 (커스텀)
  addStrategy(strategy: Strategy): void {
    strategy.isCustom = true;
    strategy.id = `custom_${Date.now()}`;
    this.strategies.push(strategy);
    this.addLog(`전략 추가: ${strategy.name}`, 'info');
  }

  // 전략 수정
  updateStrategy(strategyId: string, updates: Partial<Strategy>): void {
    const index = this.strategies.findIndex(s => s.id === strategyId);
    if (index >= 0) {
      this.strategies[index] = { ...this.strategies[index], ...updates };
      // 현재 전략이면 currentStrategy도 업데이트
      if (this.currentStrategy.id === strategyId) {
        this.currentStrategy = this.strategies[index];
      }
      this.addLog(`전략 수정: ${this.strategies[index].name}`, 'info');
    }
  }

  // 전략 삭제 (커스텀만)
  deleteStrategy(strategyId: string): void {
    const strategy = this.strategies.find(s => s.id === strategyId);
    if (strategy && strategy.isCustom) {
      this.strategies = this.strategies.filter(s => s.id !== strategyId);
      // 현재 전략이 삭제되면 기본으로
      if (this.currentStrategy.id === strategyId) {
        this.selectStrategy('balanced');
      }
      this.addLog(`전략 삭제: ${strategy.name}`, 'info');
    }
  }

  // 전략 복제 (커스텀 생성용)
  duplicateStrategy(strategyId: string, newName: string): Strategy | null {
    const source = this.strategies.find(s => s.id === strategyId);
    if (!source) return null;
    
    const newStrategy: Strategy = {
      ...JSON.parse(JSON.stringify(source)),
      id: `custom_${Date.now()}`,
      name: newName,
      isCustom: true,
    };
    this.strategies.push(newStrategy);
    this.addLog(`전략 복제: ${newName}`, 'info');
    return newStrategy;
  }

  // 전략 목록 가져오기
  getStrategies(): Strategy[] {
    return [...this.strategies];
  }

  // 현재 전략 가져오기
  getCurrentStrategy(): Strategy {
    return this.currentStrategy;
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
    const currentTick = this.gameState.getCurrentTick();
    
    if (request.type === 'attack') {
      if (optionId === 'approve' || optionId === 'attack_full') {
        this.launchAttack();
        this.addLog('공격 개시!', 'action');
      } else if (optionId === 'attack_harass') {
        this.launchHarass();
        this.addLog('견제 공격 개시', 'action');
      } else {
        this.addLog('공격 대기', 'info');
      }
      this.lastAttackSuggestionTick = currentTick;
    } else if (request.type === 'expand') {
      if (optionId === 'approve' || optionId === 'expand_now') {
        this.buildExpansion();
        this.addLog('확장 시작!', 'action');
      } else if (optionId === 'expand_defend') {
        this.buildDefenseStructure();
        this.addLog('방어 구조물 우선', 'action');
      } else {
        this.addLog('확장 보류', 'info');
      }
      this.lastExpandSuggestionTick = currentTick;
    } else if (request.type === 'tech') {
      if (optionId === 'approve' || optionId === 'tech_factory') {
        this.buildTechBuilding();
        this.addLog('테크 전환!', 'action');
      } else if (optionId === 'tech_infantry') {
        this.addLog('보병 유지', 'info');
      } else {
        this.addLog('테크 보류', 'info');
      }
      this.lastTechSuggestionTick = currentTick;
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

    this.updateEnemyIntel(currentTick);
    
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
    
    // 다양한 제안 체크 (승인 요청 없을 때만)
    if (!this.approvalRequest) {
      this.checkAttackTiming(currentTick);
      this.checkExpandTiming(currentTick, resources);
      this.checkTechTiming(currentTick, resources);
      this.checkEnemyApproach(currentTick);
    }
    
    // 유닛 손실 감지
    this.checkArmyLoss();
  }

  // 계획 액션 업데이트
  private updatePlanActions(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    this.nextActions = [];
    
    const myBuildings = this.getMyBuildings();
    const myUnits = this.getMyUnits();
    const workers = myUnits.filter(u => u.getComponent<Unit>(Unit)?.unitType === UnitType.SCV);
    const combatUnits = this.getCombatUnits();
    const strategy = this.currentStrategy;
    
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
          description: `${this.getUnitName(current.unitType)} 생산 중`,
          progress: current.progress,
        });
      }
    }
    
    // 2. 다음 예정 행동 (전략 기반)
    // 일꾼 부족하면
    if (workers.length < strategy.workerTarget && resources.minerals >= 50) {
      this.nextActions.push({
        id: 'plan-scv',
        type: 'production',
        description: `SCV 생산 예정 (${workers.length}/${strategy.workerTarget})`,
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
    if (combatUnits.length >= strategy.attackThreshold) {
      this.nextActions.push({
        id: 'plan-attack',
        type: 'attack',
        description: `공격 준비 완료 (${combatUnits.length}/${strategy.attackThreshold}기)`,
      });
    }
    
    // 유닛 생산 목표 표시
    for (const config of strategy.unitProduction) {
      if (!config.enabled || config.unitType === UnitType.SCV) continue;
      const count = myUnits.filter(u => u.getComponent<Unit>(Unit)?.unitType === config.unitType).length;
      if (config.targetCount > 0 && count < config.targetCount) {
        this.nextActions.push({
          id: `plan-${config.unitType}`,
          type: 'production',
          description: `${this.getUnitName(config.unitType)} (${count}/${config.targetCount})`,
        });
      }
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

  // 자동 생산 (Strategy 기반)
  private manageProduction(resources: { minerals: number; gas: number; supply: number; supplyMax: number }): void {
    const myBuildings = this.getMyBuildings();
    const buildingTypes = myBuildings.map(b => b.getComponent<Building>(Building)!.buildingType);
    const myUnits = this.getMyUnits();
    const strategy = this.currentStrategy;
    
    // 유닛 타입별 현재 수 계산
    const unitCounts = new Map<UnitType, number>();
    for (const unit of myUnits) {
      const unitComp = unit.getComponent<Unit>(Unit);
      if (unitComp) {
        unitCounts.set(unitComp.unitType, (unitCounts.get(unitComp.unitType) || 0) + 1);
      }
    }
    
    // 우선순위 순으로 정렬된 생산 설정
    const sortedProduction = [...strategy.unitProduction]
      .filter(p => p.enabled)
      .sort((a, b) => b.priority - a.priority);
    
    // 건물별로 생산
    for (const building of myBuildings) {
      const buildingComp = building.getComponent<Building>(Building)!;
      const queue = building.getComponent<ProductionQueue>(ProductionQueue);
      
      if (!queue || buildingComp.isConstructing) continue;
      if (!queue.canQueue()) continue;
      
      // 이 건물에서 생산 가능한 유닛 찾기 (우선순위 순)
      for (const config of sortedProduction) {
        const currentCount = unitCounts.get(config.unitType) || 0;
        
        // 목표 수 체크 (0이면 무제한)
        if (config.targetCount > 0 && currentCount >= config.targetCount) continue;
        
        // 비용 체크
        if (!this.canAfford(config.unitType, resources)) continue;
        
        // 건물 요구사항 체크
        if (!canTrainUnit(config.unitType, buildingTypes)) continue;
        
        // 해당 건물에서 생산 가능한지 체크
        if (!this.canBuildingProduceUnit(buildingComp.buildingType, config.unitType)) continue;
        
        // 생산!
        this.trainUnit(queue, config.unitType);
        this.addLog(`${this.getUnitName(config.unitType)} 생산 시작`, 'action');
        break; // 한 건물당 한 유닛씩
      }
    }
  }

  // 건물이 해당 유닛을 생산할 수 있는지 체크
  private canBuildingProduceUnit(buildingType: BuildingType, unitType: UnitType): boolean {
    const production: Record<BuildingType, UnitType[]> = {
      [BuildingType.COMMAND_CENTER]: [UnitType.SCV],
      [BuildingType.BARRACKS]: [UnitType.MARINE, UnitType.FIREBAT, UnitType.MEDIC],
      [BuildingType.FACTORY]: [UnitType.VULTURE, UnitType.SIEGE_TANK, UnitType.GOLIATH],
      [BuildingType.SUPPLY_DEPOT]: [],
      [BuildingType.REFINERY]: [],
      [BuildingType.ENGINEERING_BAY]: [],
      [BuildingType.ARMORY]: [],
      [BuildingType.BUNKER]: [],
      [BuildingType.MISSILE_TURRET]: [],
    };
    return production[buildingType]?.includes(unitType) || false;
  }

  // 유닛 이름 (한글)
  private getUnitName(unitType: UnitType): string {
    const names: Record<UnitType, string> = {
      [UnitType.SCV]: 'SCV',
      [UnitType.MARINE]: '마린',
      [UnitType.FIREBAT]: '파이어뱃',
      [UnitType.MEDIC]: '메딕',
      [UnitType.VULTURE]: '벌처',
      [UnitType.SIEGE_TANK]: '시즈탱크',
      [UnitType.GOLIATH]: '골리앗',
    };
    return names[unitType] || unitType;
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
    const confidence = this.getIntelConfidence(currentTick);
    const powerRatio = this.getCombatPowerRatio();
    const effectivePowerRatio = this.applyConfidencePenalty(powerRatio, confidence);
    const nearbyEnemies = this.getNearbyEnemyCount(400);
    const canHarass = this.getHarassUnits().length >= 2 && this.getEnemyWorkers().length > 0;

    let adjustedThreshold = threshold;
    if (confidence < 0.5) {
      adjustedThreshold = Math.ceil(threshold * 1.3);
    } else if (effectivePowerRatio > 1.5) {
      adjustedThreshold = Math.max(3, Math.floor(threshold * 0.8));
    }

    if (nearbyEnemies >= 2) return;

    const armyFactor = Math.min(1, combatUnits.length / Math.max(1, adjustedThreshold));
    const ratioFactor = Math.min(1.6, effectivePowerRatio) / 1.6;
    const infoFactor = confidence;
    const riskScore = this.getRiskScore(confidence, powerRatio, nearbyEnemies);
    const opportunityScore = armyFactor * 0.5 + ratioFactor * 0.35 + infoFactor * 0.15 - riskScore * 0.2;
    const riskLabel = this.getRiskLabel(riskScore);
    const infoLabel = this.getConfidenceLabel(confidence);
    const timingLabel = effectivePowerRatio >= 1.2 ? '우위' : effectivePowerRatio >= 1.0 ? '근소 우위' : '팽팽';

    if (combatUnits.length >= adjustedThreshold && effectivePowerRatio >= 1.0 && opportunityScore >= 0.55) {
      const options = [
        { id: 'approve', label: '총공격' },
        ...(canHarass ? [{ id: 'attack_harass', label: '견제' }] : []),
        { id: 'attack_delay', label: '대기' },
      ];
      this.approvalRequest = {
        id: `attack-${currentTick}`,
        type: 'attack',
        title: '공격 준비 완료',
        description: `전투 ${combatUnits.length}기, 전투력 ${powerRatio.toFixed(2)}x (${timingLabel}), 정보 ${infoLabel}, 위험도 ${riskLabel}.`,
        options,
      };
      this.lastAttackSuggestionTick = currentTick;
    }
  }

  // 전략에 따른 공격 임계값
  private getAttackThreshold(): number {
    return this.currentStrategy.attackThreshold;
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

  private launchHarass(): void {
    const harassUnits = this.getHarassUnits();
    if (harassUnits.length < 2) return;

    const enemyWorkers = this.getEnemyWorkers();
    if (enemyWorkers.length === 0) return;

    const target = this.selectHarassTarget(harassUnits, enemyWorkers);
    const targetPos = target.getComponent<Position>(Position);
    if (!targetPos) return;

    for (const unit of harassUnits) {
      const movement = unit.getComponent<Movement>(Movement);
      const combat = unit.getComponent<Combat>(Combat);
      if (movement && combat) {
        combat.startAttackMove(targetPos.x, targetPos.y);
        movement.setTarget(targetPos.x, targetPos.y);
      }
    }
  }

  // 확장 타이밍 제안
  private checkExpandTiming(currentTick: number, resources: { minerals: number; gas: number }): void {
    if (currentTick - this.lastExpandSuggestionTick < this.expandSuggestionCooldown) return;
    
    // 미네랄이 400 이상이고 커맨드센터가 1개일 때
    const commandCenters = this.getMyBuildings().filter(b => 
      b.getComponent<Building>(Building)?.buildingType === BuildingType.COMMAND_CENTER
    );
    
    if (resources.minerals >= 400 && commandCenters.length === 1) {
      const confidence = this.getIntelConfidence(currentTick);
      const powerRatio = this.getCombatPowerRatio();
      const effectivePowerRatio = this.applyConfidencePenalty(powerRatio, confidence);
      const nearbyEnemies = this.getNearbyEnemyCount(350);
      const riskScore = this.getRiskScore(confidence, powerRatio, nearbyEnemies);
      const riskLabel = this.getRiskLabel(riskScore);
      const infoLabel = this.getConfidenceLabel(confidence);
      const canDefend = this.getDefenseBuildCandidate(resources) !== null;

      if (nearbyEnemies > 0) return;
      if (confidence > 0.6 && effectivePowerRatio < 0.85) return;

      const options = [
        { id: 'approve', label: '확장' },
        ...(canDefend ? [{ id: 'expand_defend', label: '방어 우선' }] : []),
        { id: 'expand_delay', label: '대기' },
      ];

      this.approvalRequest = {
        id: `expand-${currentTick}`,
        type: 'expand',
        title: '확장 타이밍',
        description: `자원 ${resources.minerals} 확보. 정보 ${infoLabel}, 위험도 ${riskLabel}.`,
        options,
      };
      this.lastExpandSuggestionTick = currentTick;
    }
  }

  // 테크 전환 제안
  private checkTechTiming(currentTick: number, resources: { minerals: number; gas: number }): void {
    if (currentTick - this.lastTechSuggestionTick < this.techSuggestionCooldown) return;
    
    const myBuildings = this.getMyBuildings();
    const buildingTypes = myBuildings.map(b => b.getComponent<Building>(Building)!.buildingType);
    
    const hasBarracks = buildingTypes.includes(BuildingType.BARRACKS);
    const hasFactory = buildingTypes.includes(BuildingType.FACTORY);
    
    // 배럭은 있는데 팩토리가 없고, 자원이 충분할 때
    if (hasBarracks && !hasFactory && resources.minerals >= 200 && resources.gas >= 100) {
      const confidence = this.getIntelConfidence(currentTick);
      const powerRatio = this.getCombatPowerRatio();
      const effectivePowerRatio = this.applyConfidencePenalty(powerRatio, confidence);
      const nearbyEnemies = this.getNearbyEnemyCount(350);
      const riskScore = this.getRiskScore(confidence, powerRatio, nearbyEnemies);
      const riskLabel = this.getRiskLabel(riskScore);
      const infoLabel = this.getConfidenceLabel(confidence);

      if (nearbyEnemies > 0) return;
      if (confidence > 0.6 && effectivePowerRatio < 0.9) return;

      this.approvalRequest = {
        id: `tech-${currentTick}`,
        type: 'tech',
        title: '테크 전환',
        description: `팩토리 전환 제안. 정보 ${infoLabel}, 위험도 ${riskLabel}.`,
        options: [
          { id: 'approve', label: '팩토리' },
          { id: 'tech_infantry', label: '보병 유지' },
          { id: 'tech_delay', label: '대기' },
        ],
      };
      this.lastTechSuggestionTick = currentTick;
    }
  }

  private getRiskScore(confidence: number, powerRatio: number, nearbyEnemies: number): number {
    const threatScore = this.getThreatScore();
    const threat = Math.max(Math.min(1, nearbyEnemies / 3), threatScore);
    const disadvantage = Math.max(0, 1 - powerRatio);
    const infoRisk = 1 - confidence;
    return Math.min(1, threat * 0.5 + disadvantage * 0.3 + infoRisk * 0.2);
  }

  private applyConfidencePenalty(powerRatio: number, confidence: number): number {
    const penalty = 1 + (1 - confidence) * 0.35;
    return powerRatio / penalty;
  }

  private getRiskLabel(riskScore: number): string {
    if (riskScore >= 0.7) return '높음';
    if (riskScore >= 0.4) return '중간';
    return '낮음';
  }

  private getConfidenceLabel(confidence: number): string {
    if (confidence >= 0.75) return '높음';
    if (confidence >= 0.5) return '중간';
    return '낮음';
  }

  private updateEnemyIntel(currentTick: number): void {
    const enemies = this.getEnemyEntities();
    if (enemies.length === 0) {
      this.lastIntelConfidence = Math.max(0.2, this.lastIntelConfidence - 0.02);
      return;
    }

    const aliveIds = new Set(enemies.map(enemy => enemy.id));
    for (const id of this.enemyLastSeen.keys()) {
      if (!aliveIds.has(id)) {
        this.enemyLastSeen.delete(id);
      }
    }

    let observedCount = 0;
    for (const enemy of enemies) {
      if (this.isEnemyObserved(enemy)) {
        observedCount += 1;
        this.enemyLastSeen.set(enemy.id, currentTick);
      }
    }

    if (observedCount > 0) {
      this.lastEnemySeenTick = currentTick;
    }

    let confidenceSum = 0;
    for (const enemy of enemies) {
      const lastSeen = this.enemyLastSeen.get(enemy.id);
      if (lastSeen === undefined) {
        confidenceSum += 0.35;
        continue;
      }

      const age = Math.max(0, currentTick - lastSeen);
      const decay = Math.exp(-age / this.intelDecayWindow);
      const confidence = Math.max(this.intelMinConfidence, decay);
      confidenceSum += confidence;
    }

    const avgConfidence = confidenceSum / enemies.length;
    this.lastIntelConfidence = Math.min(1, Math.max(this.intelMinConfidence, avgConfidence));
  }

  private isEnemyObserved(enemy: Entity): boolean {
    const enemyPos = enemy.getComponent<Position>(Position);
    if (!enemyPos) return false;

    const observers = [...this.getMyUnits(), ...this.getMyBuildings()];
    for (const observer of observers) {
      const pos = observer.getComponent<Position>(Position);
      if (!pos) continue;
      const dist = Math.hypot(pos.x - enemyPos.x, pos.y - enemyPos.y);
      if (dist < 600) return true;
    }

    return false;
  }

  private getIntelConfidence(currentTick: number): number {
    if (this.lastEnemySeenTick === 0) return this.lastIntelConfidence;
    const ticksSince = currentTick - this.lastEnemySeenTick;
    if (ticksSince <= 0) return this.lastIntelConfidence;
    const decay = Math.max(0, this.lastIntelConfidence - ticksSince / (this.intelDecayWindow * 2));
    return Math.max(this.intelMinConfidence, decay);
  }

  private getCombatPowerRatio(): number {
    const myPower = this.getCombatPower(this.getCombatUnits());
    const enemyUnits = this.getEnemyEntities().filter(e => e.getComponent<Unit>(Unit));
    const enemyPower = this.getCombatPower(enemyUnits);
    if (enemyPower <= 0) return 2;
    return myPower / enemyPower;
  }

  private getCombatPower(entities: Entity[]): number {
    let power = 0;
    for (const entity of entities) {
      const unit = entity.getComponent<Unit>(Unit);
      if (!unit) continue;
      const stats = UNIT_STATS[unit.unitType];
      const dps = stats.attackSpeed > 0 ? stats.damage / stats.attackSpeed : 0;
      const rangeFactor = Math.max(1, stats.range * 0.6);
      const hpFactor = unit.hp * 0.6 + unit.maxHp * 0.1;
      power += hpFactor + dps * 8 + rangeFactor * 4;
    }
    return power;
  }

  private getHarassUnits(): Entity[] {
    const combatUnits = this.getCombatUnits();
    const sorted = [...combatUnits].sort((a, b) => {
      const unitA = a.getComponent<Unit>(Unit);
      const unitB = b.getComponent<Unit>(Unit);
      if (!unitA || !unitB) return 0;
      return UNIT_STATS[unitB.unitType].moveSpeed - UNIT_STATS[unitA.unitType].moveSpeed;
    });
    return sorted.slice(0, 3);
  }

  private getEnemyWorkers(): Entity[] {
    return this.getEnemyEntities().filter(e => {
      const unit = e.getComponent<Unit>(Unit);
      return unit?.unitType === UnitType.SCV;
    });
  }

  private selectHarassTarget(harassUnits: Entity[], enemyWorkers: Entity[]): Entity {
    const center = this.getUnitsCenter(harassUnits);
    if (!center) return enemyWorkers[0];

    let best = enemyWorkers[0];
    let bestScore = -Infinity;
    for (const worker of enemyWorkers) {
      const pos = worker.getComponent<Position>(Position);
      if (!pos) continue;
      const dist = Math.hypot(pos.x - center.x, pos.y - center.y);
      const hpPercent = this.getEntityHpPercent(worker);
      const score = 60 - dist * 0.04 + (1 - hpPercent) * 12;
      if (score > bestScore) {
        bestScore = score;
        best = worker;
      }
    }

    return best;
  }

  private getEntityHpPercent(entity: Entity): number {
    const unit = entity.getComponent<Unit>(Unit);
    if (unit) {
      return unit.maxHp > 0 ? unit.hp / unit.maxHp : 1;
    }

    const building = entity.getComponent<Building>(Building);
    if (building) {
      return building.maxHp > 0 ? building.hp / building.maxHp : 1;
    }

    return 1;
  }

  private getUnitsCenter(units: Entity[]): { x: number; y: number } | null {
    if (units.length === 0) return null;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const unit of units) {
      const pos = unit.getComponent<Position>(Position);
      if (!pos) continue;
      sumX += pos.x;
      sumY += pos.y;
      count += 1;
    }
    if (count === 0) return null;
    return { x: sumX / count, y: sumY / count };
  }

  private getNearbyEnemyCount(radius: number): number {
    const myBuildings = this.getMyBuildings();
    const myCC = myBuildings.find(b => b.getComponent<Building>(Building)?.buildingType === BuildingType.COMMAND_CENTER);
    const basePos = myCC?.getComponent<Position>(Position);
    if (!basePos) return 0;

    return this.getEnemyEntities().filter(e => {
      const pos = e.getComponent<Position>(Position);
      if (!pos) return false;
      return Math.hypot(pos.x - basePos.x, pos.y - basePos.y) < radius;
    }).length;
  }

  private getThreatScore(): number {
    const myBuildings = this.getMyBuildings();
    const myCC = myBuildings.find(b => b.getComponent<Building>(Building)?.buildingType === BuildingType.COMMAND_CENTER);
    const basePos = myCC?.getComponent<Position>(Position);
    if (!basePos) return 0;

    const radius = 420;
    const enemies = this.getEnemyEntities().filter(e => {
      const unit = e.getComponent<Unit>(Unit);
      return !!unit && unit.unitType !== UnitType.SCV;
    });

    let threat = 0;
    for (const enemy of enemies) {
      const pos = enemy.getComponent<Position>(Position);
      if (!pos) continue;
      const dist = Math.hypot(pos.x - basePos.x, pos.y - basePos.y);
      if (dist > radius) continue;
      threat += 1 - dist / radius;
    }

    return Math.min(1, threat / 4);
  }

  // 적 접근 감지
  private checkEnemyApproach(currentTick: number): void {
    if (currentTick - this.lastEnemyCheckTick < this.enemyCheckInterval) return;
    this.lastEnemyCheckTick = currentTick;
    
    if (currentTick - this.lastDefenseSuggestionTick < this.defenseSuggestionCooldown) return;
    
    // 내 커맨드센터 위치
    const myCC = this.getMyBuildings().find(b => 
      b.getComponent<Building>(Building)?.buildingType === BuildingType.COMMAND_CENTER
    );
    if (!myCC) return;
    
    const ccPos = myCC.getComponent<Position>(Position);
    if (!ccPos) return;
    
    // 적 유닛이 내 베이스 근처에 있는지 체크
    const enemies = this.getEnemyEntities().filter(e => e.getComponent<Unit>(Unit));
    const nearbyEnemies = enemies.filter(e => {
      const pos = e.getComponent<Position>(Position);
      if (!pos) return false;
      const dist = Math.sqrt(Math.pow(pos.x - ccPos.x, 2) + Math.pow(pos.y - ccPos.y, 2));
      return dist < 400; // 400픽셀 이내
    });
    
    if (nearbyEnemies.length >= 2) {
      this.addLog(`경고: 적 ${nearbyEnemies.length}기 접근 중!`, 'warning');
      this.lastDefenseSuggestionTick = currentTick;
    }
  }

  // 유닛 손실 감지
  private checkArmyLoss(): void {
    const currentArmy = this.getCombatUnits().length;
    
    if (this.lastArmyCount > 0 && currentArmy < this.lastArmyCount) {
      const lost = this.lastArmyCount - currentArmy;
      if (lost >= 2) {
        this.addLog(`유닛 ${lost}기 손실!`, 'warning');
      }
    }
    
    this.lastArmyCount = currentArmy;
  }

  // 확장 건설
  private buildExpansion(): void {
    const idleWorkers = this.getIdleWorkers();
    if (idleWorkers.length === 0) {
      this.addLog('건설 가능한 SCV 없음', 'warning');
      return;
    }
    
    const resources = this.gameState.getPlayerResources(this.playerId);
    if (!resources || resources.minerals < BUILDING_STATS[BuildingType.COMMAND_CENTER].mineralCost) {
      this.addLog('자원 부족', 'warning');
      return;
    }
    
    const buildPos = this.findExpansionLocation();
    if (!buildPos) {
      this.addLog('확장 위치를 찾을 수 없음', 'warning');
      return;
    }
    
    const worker = idleWorkers[0];
    this.gameState.modifyPlayerResources(this.playerId, {
      minerals: -BUILDING_STATS[BuildingType.COMMAND_CENTER].mineralCost,
    });
    
    const builder = worker.getComponent<Builder>(Builder);
    const gatherer = worker.getComponent<Gatherer>(Gatherer);
    const movement = worker.getComponent<Movement>(Movement);
    
    if (builder && movement) {
      builder.startBuildCommand(BuildingType.COMMAND_CENTER, buildPos.x, buildPos.y);
      movement.setTarget(buildPos.x, buildPos.y);
      if (gatherer) gatherer.stop();
    }
  }

  // 테크 건물 건설
  private buildTechBuilding(): void {
    const idleWorkers = this.getIdleWorkers();
    if (idleWorkers.length === 0) {
      this.addLog('건설 가능한 SCV 없음', 'warning');
      return;
    }
    
    const resources = this.gameState.getPlayerResources(this.playerId);
    if (!resources || 
        resources.minerals < BUILDING_STATS[BuildingType.FACTORY].mineralCost ||
        resources.gas < BUILDING_STATS[BuildingType.FACTORY].gasCost) {
      this.addLog('자원 부족', 'warning');
      return;
    }
    
    const buildPos = this.findBuildLocation(BuildingType.FACTORY);
    if (!buildPos) {
      this.addLog('건설 위치를 찾을 수 없음', 'warning');
      return;
    }
    
    const worker = idleWorkers[0];
    this.gameState.modifyPlayerResources(this.playerId, {
      minerals: -BUILDING_STATS[BuildingType.FACTORY].mineralCost,
      gas: -BUILDING_STATS[BuildingType.FACTORY].gasCost,
    });
    
    const builder = worker.getComponent<Builder>(Builder);
    const gatherer = worker.getComponent<Gatherer>(Gatherer);
    const movement = worker.getComponent<Movement>(Movement);
    
    if (builder && movement) {
      builder.startBuildCommand(BuildingType.FACTORY, buildPos.x, buildPos.y);
      movement.setTarget(buildPos.x, buildPos.y);
      if (gatherer) gatherer.stop();
    }
  }

  private buildDefenseStructure(): void {
    const resources = this.gameState.getPlayerResources(this.playerId);
    if (!resources) {
      this.addLog('자원 정보 없음', 'warning');
      return;
    }

    const defenseType = this.getDefenseBuildCandidate(resources);
    if (!defenseType) {
      this.addLog('방어 건설 조건 부족', 'info');
      return;
    }

    const idleWorkers = this.getIdleWorkers();
    if (idleWorkers.length === 0) {
      this.addLog('건설 가능한 SCV 없음', 'warning');
      return;
    }

    const stats = BUILDING_STATS[defenseType];
    if (resources.minerals < stats.mineralCost || resources.gas < stats.gasCost) {
      this.addLog('자원 부족', 'warning');
      return;
    }

    const buildPos = this.findBuildLocation(defenseType);
    if (!buildPos) {
      this.addLog('건설 위치를 찾을 수 없음', 'warning');
      return;
    }

    const worker = idleWorkers[0];
    this.gameState.modifyPlayerResources(this.playerId, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });

    const builder = worker.getComponent<Builder>(Builder);
    const gatherer = worker.getComponent<Gatherer>(Gatherer);
    const movement = worker.getComponent<Movement>(Movement);

    if (builder && movement) {
      builder.startBuildCommand(defenseType, buildPos.x, buildPos.y);
      movement.setTarget(buildPos.x, buildPos.y);
      if (gatherer) gatherer.stop();
    }
  }

  private getDefenseBuildCandidate(resources: { minerals: number; gas: number }): BuildingType | null {
    const buildingTypes = this.getMyBuildings().map(b => b.getComponent<Building>(Building)!.buildingType);
    const bunker = BuildingType.BUNKER;
    const turret = BuildingType.MISSILE_TURRET;

    if (canBuildBuilding(bunker, buildingTypes) && resources.minerals >= BUILDING_STATS[bunker].mineralCost) {
      return bunker;
    }

    if (canBuildBuilding(turret, buildingTypes) && resources.minerals >= BUILDING_STATS[turret].mineralCost) {
      return turret;
    }

    return null;
  }

  // 확장 위치 찾기 (기존 베이스에서 멀리)
  private findExpansionLocation(): { x: number; y: number } | null {
    const tileSize = this.gameState.config.tileSize;
    const mapWidth = this.gameState.config.mapWidth;
    const mapHeight = this.gameState.config.mapHeight;
    
    // 맵 중앙 근처에서 확장 위치 찾기
    const centerX = Math.floor(mapWidth / 2);
    const centerY = Math.floor(mapHeight / 2);
    
    const stats = BUILDING_STATS[BuildingType.COMMAND_CENTER];
    
    for (let radius = 5; radius < 20; radius++) {
      for (let angle = 0; angle < 8; angle++) {
        const offsetX = Math.round(Math.cos(angle * Math.PI / 4) * radius);
        const offsetY = Math.round(Math.sin(angle * Math.PI / 4) * radius);
        
        const tileX = centerX + offsetX;
        const tileY = centerY + offsetY;
        
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

  // 계획 스냅샷 (UI용)
  getPlanSnapshot(): PlanSnapshot {
    const workers = this.getMyUnits().filter(u => u.getComponent<Unit>(Unit)?.unitType === UnitType.SCV).length;
    const army = this.getCombatUnits().length;
    const buildings = this.getMyBuildings().length;
    
    return {
      enabled: this.settings.enabled,
      stance: this.settings.stance,
      currentStrategy: this.currentStrategy,
      availableStrategies: [...this.strategies],
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
