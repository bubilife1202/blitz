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

export enum Race {
  VANGUARD = 'vanguard',
  LUMINARI = 'luminari',
  HIVEMIND = 'hivemind',
}

// AI 난이도
export enum AIDifficulty {
  EASY = 'easy',
  NORMAL = 'normal',
  HARD = 'hard',
}

export enum UnitType {
  ENGINEER = 'engineer',
  TROOPER = 'trooper',
  PYRO = 'pyro',
  MEDIC = 'medic',
  SPEEDER = 'speeder',
  ARTILLERY = 'artillery',
  WALKER = 'walker',
}

export enum BuildingType {
  HQ = 'hq',
  DEPOT = 'depot',
  REFINERY = 'refinery',
  BARRACKS = 'barracks',
  FACTORY = 'factory',
  TECH_LAB = 'tech_lab',
  ARMORY = 'armory',
  BUNKER = 'bunker',
  TURRET = 'turret',
}

export enum UpgradeType {
  INFANTRY_WEAPONS_1 = 'infantry_weapons_1',
  INFANTRY_WEAPONS_2 = 'infantry_weapons_2',
  INFANTRY_WEAPONS_3 = 'infantry_weapons_3',
  INFANTRY_ARMOR_1 = 'infantry_armor_1',
  INFANTRY_ARMOR_2 = 'infantry_armor_2',
  INFANTRY_ARMOR_3 = 'infantry_armor_3',
  VEHICLE_WEAPONS_1 = 'vehicle_weapons_1',
  VEHICLE_WEAPONS_2 = 'vehicle_weapons_2',
  VEHICLE_WEAPONS_3 = 'vehicle_weapons_3',
  VEHICLE_ARMOR_1 = 'vehicle_armor_1',
  VEHICLE_ARMOR_2 = 'vehicle_armor_2',
  VEHICLE_ARMOR_3 = 'vehicle_armor_3',
  STIM_PACK = 'stim_pack',
  EXTENDED_RANGE = 'extended_range',
  BOMBARDMENT_MODE = 'bombardment_mode',
  BOOSTERS = 'boosters',
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
  BOMBARDMENT = 'bombardment',
  STIM = 'stim',
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
  mapId?: string; // 맵 ID (예: 'city_warfare', 'volcanic_highlands', 'desert_outpost')
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
