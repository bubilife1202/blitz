// ==========================================
// 공유 타입 정의 (클라이언트/서버 공용)
// ==========================================

export type EntityId = number;
export type PlayerId = number;
export type ComponentType = string;

// 2D 좌표
export interface Vector2 {
  x: number;
  y: number;
}

// 종족 타입
export enum Race {
  TERRAN = 'terran',
  PROTOSS = 'protoss',
  ZERG = 'zerg',
}

// AI 난이도
export enum AIDifficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
}

// 유닛 타입
export enum UnitType {
  // Terran - Infantry
  SCV = 'scv',
  MARINE = 'marine',
  FIREBAT = 'firebat',
  MEDIC = 'medic',
  // Terran - Vehicles
  VULTURE = 'vulture',
  SIEGE_TANK = 'siege_tank',
  GOLIATH = 'goliath',
}

// 건물 타입
export enum BuildingType {
  // Terran - Basic
  COMMAND_CENTER = 'command_center',
  SUPPLY_DEPOT = 'supply_depot',
  REFINERY = 'refinery',
  // Terran - Production
  BARRACKS = 'barracks',
  FACTORY = 'factory',
  // Terran - Tech
  ENGINEERING_BAY = 'engineering_bay',
  ARMORY = 'armory',
  // Terran - Defense
  BUNKER = 'bunker',
  MISSILE_TURRET = 'missile_turret',
}

// 업그레이드 타입
export enum UpgradeType {
  // Infantry Upgrades (Engineering Bay)
  INFANTRY_WEAPONS_1 = 'infantry_weapons_1',
  INFANTRY_WEAPONS_2 = 'infantry_weapons_2',
  INFANTRY_WEAPONS_3 = 'infantry_weapons_3',
  INFANTRY_ARMOR_1 = 'infantry_armor_1',
  INFANTRY_ARMOR_2 = 'infantry_armor_2',
  INFANTRY_ARMOR_3 = 'infantry_armor_3',
  // Vehicle Upgrades (Armory)
  VEHICLE_WEAPONS_1 = 'vehicle_weapons_1',
  VEHICLE_WEAPONS_2 = 'vehicle_weapons_2',
  VEHICLE_WEAPONS_3 = 'vehicle_weapons_3',
  VEHICLE_ARMOR_1 = 'vehicle_armor_1',
  VEHICLE_ARMOR_2 = 'vehicle_armor_2',
  VEHICLE_ARMOR_3 = 'vehicle_armor_3',
  // Special Upgrades
  STIM_PACK = 'stim_pack',
  U238_SHELLS = 'u238_shells', // Marine range +1
  SIEGE_TECH = 'siege_tech', // Siege Tank siege mode
  ION_THRUSTERS = 'ion_thrusters', // Vulture speed
}

// 자원 타입
export enum ResourceType {
  MINERALS = 'minerals',
  GAS = 'gas',
}

// 플레이어 자원 상태
export interface PlayerResources {
  minerals: number;
  gas: number;
  supply: number;
  supplyMax: number;
}

// 게임 명령 타입 (클라이언트 → 서버)
export enum CommandType {
  MOVE = 'move',
  ATTACK = 'attack',
  STOP = 'stop',
  HOLD = 'hold',
  BUILD = 'build',
  TRAIN = 'train',
  GATHER = 'gather',
  RESEARCH = 'research',
  SIEGE = 'siege', // Siege Tank mode toggle
  STIM = 'stim', // Stim pack activation
}

// 게임 명령 인터페이스
export interface GameCommand {
  type: CommandType;
  playerId: PlayerId;
  entityIds: EntityId[];
  targetPosition?: Vector2;
  targetEntityId?: EntityId;
  buildingType?: BuildingType;
  unitType?: UnitType;
  upgradeType?: UpgradeType;
  entityTargets?: Record<EntityId, Vector2>;
  entityPaths?: Record<EntityId, Vector2[]>;
  tick: number; // 명령이 실행될 틱
}

// 게임 설정
export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  tickRate: number; // 초당 틱 수
}

// 게임 상태 스냅샷 (동기화용)
export interface GameSnapshot {
  tick: number;
  entities: SerializedEntity[];
  players: PlayerState[];
}

export interface SerializedEntity {
  id: EntityId;
  components: Record<ComponentType, unknown>;
}

export interface PlayerState {
  id: PlayerId;
  race: Race;
  resources: PlayerResources;
  isDefeated: boolean;
  upgrades: UpgradeType[]; // 연구 완료된 업그레이드
}

// 유닛 카테고리
export enum UnitCategory {
  INFANTRY = 'infantry',
  VEHICLE = 'vehicle',
  WORKER = 'worker',
}
