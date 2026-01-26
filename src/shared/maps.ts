// ==========================================
// 맵 데이터 정의
// ==========================================

// 지형 타입
export enum TerrainType {
  GROUND = 0,       // 일반 땅 (이동 가능)
  HIGH_GROUND = 1,  // 고지대 (이동 가능, 시야 보너스)
  WATER = 2,        // 물 (이동 불가)
  CLIFF = 3,        // 절벽 (이동 불가)
  ROAD = 4,         // 도로 (빠른 이동)
  BRIDGE = 5,       // 다리 (이동 가능)
  DECO_BUILDING = 6, // 장식용 건물 (이동 불가)
  RAMP = 7,         // 경사로 (고지대 연결)
}

// 장식물 타입
export enum DecoType {
  NONE = 0,
  TREE = 1,
  ROCK = 2,
  RUINS = 3,
  VEHICLE_WRECK = 4,
  CRATE = 5,
  TOWER = 6,
  BUILDING_SMALL = 7,
  BUILDING_LARGE = 8,
}

// 자원 위치
export interface ResourceLocation {
  x: number;
  y: number;
  type: 'minerals' | 'gas';
  amount?: number;
}

// 시작 위치
export interface StartLocation {
  x: number;
  y: number;
  resources: ResourceLocation[];
}

// 확장 위치
export interface ExpansionLocation {
  x: number;
  y: number;
  resources: ResourceLocation[];
}

// 장식물 위치
export interface DecoLocation {
  x: number;
  y: number;
  type: DecoType;
  width?: number;
  height?: number;
}

// 맵 데이터
export interface GameMap {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  tileSize: number;
  theme: 'city' | 'mountain' | 'desert' | 'space';
  
  // 지형 데이터 (2D 배열)
  terrain: TerrainType[][];
  
  // 시작 위치 (최대 4명)
  startLocations: StartLocation[];
  
  // 확장 위치
  expansions: ExpansionLocation[];
  
  // 장식물
  decorations: DecoLocation[];
}

// ==========================================
// 헬퍼 함수
// ==========================================

// 빈 지형 배열 생성
function createTerrain(width: number, height: number, fill: TerrainType = TerrainType.GROUND): TerrainType[][] {
  const terrain: TerrainType[][] = [];
  for (let y = 0; y < height; y++) {
    terrain[y] = [];
    for (let x = 0; x < width; x++) {
      terrain[y][x] = fill;
    }
  }
  return terrain;
}

// 사각형 영역 채우기
function fillRect(
  terrain: TerrainType[][],
  x: number,
  y: number,
  width: number,
  height: number,
  type: TerrainType
): void {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      const ty = y + dy;
      const tx = x + dx;
      if (ty >= 0 && ty < terrain.length && tx >= 0 && tx < terrain[0].length) {
        terrain[ty][tx] = type;
      }
    }
  }
}

// 원형 영역 채우기
function fillCircle(
  terrain: TerrainType[][],
  cx: number,
  cy: number,
  radius: number,
  type: TerrainType
): void {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist <= radius && y >= 0 && y < terrain.length && x >= 0 && x < terrain[0].length) {
        terrain[y][x] = type;
      }
    }
  }
}

// 미네랄 라인 생성
function createMineralLine(baseX: number, baseY: number, count: number = 8): ResourceLocation[] {
  const resources: ResourceLocation[] = [];
  for (let i = 0; i < count; i++) {
    resources.push({ x: baseX + i, y: baseY, type: 'minerals', amount: 1500 });
  }
  // 가스 2개
  resources.push({ x: baseX + count + 1, y: baseY, type: 'gas', amount: 2500 });
  resources.push({ x: baseX + count + 2, y: baseY + 1, type: 'gas', amount: 2500 });
  return resources;
}

// ==========================================
// 맵 1: 도시 전쟁 (City Warfare)
// ==========================================
function createCityMap(): GameMap {
  const width = 128;
  const height = 128;
  const terrain = createTerrain(width, height, TerrainType.GROUND);
  
  // 중앙 도로망 (십자형)
  fillRect(terrain, 60, 0, 8, height, TerrainType.ROAD);  // 세로 도로
  fillRect(terrain, 0, 60, width, 8, TerrainType.ROAD);   // 가로 도로
  
  // 추가 도로
  fillRect(terrain, 30, 0, 4, height, TerrainType.ROAD);
  fillRect(terrain, 94, 0, 4, height, TerrainType.ROAD);
  fillRect(terrain, 0, 30, width, 4, TerrainType.ROAD);
  fillRect(terrain, 0, 94, width, 4, TerrainType.ROAD);
  
  // 도시 블록 (장식용 건물들)
  const buildingBlocks = [
    // 좌상 지역
    { x: 35, y: 35, w: 20, h: 20 },
    { x: 10, y: 10, w: 15, h: 15 },
    // 우상 지역
    { x: 100, y: 10, w: 18, h: 15 },
    { x: 75, y: 35, w: 15, h: 20 },
    // 좌하 지역
    { x: 10, y: 100, w: 15, h: 18 },
    { x: 35, y: 75, w: 20, h: 15 },
    // 우하 지역
    { x: 100, y: 100, w: 18, h: 18 },
    { x: 75, y: 75, w: 15, h: 15 },
    // 중앙 공원/광장
    { x: 55, y: 55, w: 18, h: 18 },
  ];
  
  // 도시 블록에 고지대 (건물 지역)
  for (const block of buildingBlocks) {
    fillRect(terrain, block.x, block.y, block.w, block.h, TerrainType.HIGH_GROUND);
  }
  
  // 물 (공원 연못, 하천)
  fillCircle(terrain, 64, 64, 5, TerrainType.WATER);
  fillRect(terrain, 0, 45, 25, 6, TerrainType.WATER);  // 좌측 하천
  fillRect(terrain, 103, 75, 25, 6, TerrainType.WATER); // 우측 하천
  
  // 다리
  fillRect(terrain, 15, 45, 10, 6, TerrainType.BRIDGE);
  fillRect(terrain, 103, 75, 10, 6, TerrainType.BRIDGE);
  
  // 장식물
  const decorations: DecoLocation[] = [];
  
  // 건물 장식
  for (const block of buildingBlocks) {
    if (block.w >= 15) {
      decorations.push({ x: block.x + 2, y: block.y + 2, type: DecoType.BUILDING_LARGE, width: 4, height: 4 });
      decorations.push({ x: block.x + 8, y: block.y + 2, type: DecoType.BUILDING_SMALL, width: 2, height: 2 });
    }
    decorations.push({ x: block.x + block.w - 4, y: block.y + block.h - 4, type: DecoType.TOWER, width: 2, height: 2 });
  }
  
  // 도로변 잔해
  decorations.push({ x: 62, y: 20, type: DecoType.VEHICLE_WRECK });
  decorations.push({ x: 62, y: 108, type: DecoType.VEHICLE_WRECK });
  decorations.push({ x: 20, y: 62, type: DecoType.CRATE });
  decorations.push({ x: 108, y: 62, type: DecoType.CRATE });
  
  return {
    id: 'city_warfare',
    name: 'City Warfare',
    description: '폐허가 된 도시에서 전투를 벌이세요. 도로를 통한 빠른 이동과 건물 지역의 고지대를 활용하세요.',
    width,
    height,
    tileSize: 32,
    theme: 'city',
    terrain,
    startLocations: [
      {
        x: 8,
        y: 8,
        resources: createMineralLine(3, 3),
      },
      {
        x: 118,
        y: 118,
        resources: createMineralLine(108, 123),
      },
      {
        x: 118,
        y: 8,
        resources: createMineralLine(108, 3),
      },
      {
        x: 8,
        y: 118,
        resources: createMineralLine(3, 123),
      },
    ],
    expansions: [
      // 중앙 확장
      { x: 50, y: 40, resources: createMineralLine(42, 35, 6) },
      { x: 78, y: 88, resources: createMineralLine(80, 93, 6) },
      // 측면 확장
      { x: 8, y: 64, resources: createMineralLine(3, 68, 6) },
      { x: 118, y: 64, resources: createMineralLine(108, 68, 6) },
      // 골드 확장 (중앙 근처)
      { x: 64, y: 80, resources: [
        { x: 56, y: 82, type: 'minerals', amount: 2000 },
        { x: 57, y: 82, type: 'minerals', amount: 2000 },
        { x: 58, y: 82, type: 'minerals', amount: 2000 },
        { x: 59, y: 82, type: 'minerals', amount: 2000 },
        { x: 62, y: 82, type: 'gas', amount: 3000 },
      ]},
    ],
    decorations,
  };
}

// ==========================================
// 맵 2: 화산 고원 (Volcanic Highlands)
// ==========================================
function createMountainMap(): GameMap {
  const width = 128;
  const height = 128;
  const terrain = createTerrain(width, height, TerrainType.GROUND);
  
  // 가장자리 절벽
  fillRect(terrain, 0, 0, width, 3, TerrainType.CLIFF);
  fillRect(terrain, 0, height - 3, width, 3, TerrainType.CLIFF);
  fillRect(terrain, 0, 0, 3, height, TerrainType.CLIFF);
  fillRect(terrain, width - 3, 0, 3, height, TerrainType.CLIFF);
  
  // 중앙 산맥 (고지대)
  fillRect(terrain, 50, 20, 28, 88, TerrainType.HIGH_GROUND);
  
  // 산맥 통과 경사로
  fillRect(terrain, 60, 35, 8, 6, TerrainType.RAMP);
  fillRect(terrain, 60, 87, 8, 6, TerrainType.RAMP);
  
  // 용암 호수 (물 대신 용암으로 표현하지만 타입은 WATER)
  fillCircle(terrain, 64, 64, 8, TerrainType.WATER);  // 중앙 용암 호수
  fillCircle(terrain, 25, 25, 5, TerrainType.WATER);   // 좌상 용암
  fillCircle(terrain, 103, 103, 5, TerrainType.WATER); // 우하 용암
  fillCircle(terrain, 25, 103, 4, TerrainType.WATER);  // 좌하 용암
  fillCircle(terrain, 103, 25, 4, TerrainType.WATER);  // 우상 용암
  
  // 절벽 지형 (작은 산들)
  fillCircle(terrain, 20, 64, 6, TerrainType.CLIFF);
  fillCircle(terrain, 108, 64, 6, TerrainType.CLIFF);
  fillCircle(terrain, 64, 10, 5, TerrainType.CLIFF);
  fillCircle(terrain, 64, 118, 5, TerrainType.CLIFF);
  
  // 장식물
  const decorations: DecoLocation[] = [
    // 바위들
    { x: 30, y: 45, type: DecoType.ROCK },
    { x: 98, y: 45, type: DecoType.ROCK },
    { x: 30, y: 83, type: DecoType.ROCK },
    { x: 98, y: 83, type: DecoType.ROCK },
    // 폐허
    { x: 55, y: 50, type: DecoType.RUINS },
    { x: 70, y: 75, type: DecoType.RUINS },
    // 고대 탑
    { x: 64, y: 30, type: DecoType.TOWER },
    { x: 64, y: 95, type: DecoType.TOWER },
  ];
  
  return {
    id: 'volcanic_highlands',
    name: 'Volcanic Highlands',
    description: '화산 고원에서 싸우세요. 중앙 산맥의 고지대를 점령하고 용암을 피해 진군하세요.',
    width,
    height,
    tileSize: 32,
    theme: 'mountain',
    terrain,
    startLocations: [
      {
        x: 10,
        y: 10,
        resources: createMineralLine(5, 15),
      },
      {
        x: 118,
        y: 118,
        resources: createMineralLine(108, 113),
      },
      {
        x: 118,
        y: 10,
        resources: createMineralLine(108, 15),
      },
      {
        x: 10,
        y: 118,
        resources: createMineralLine(5, 113),
      },
    ],
    expansions: [
      // 중앙 고지대 확장 (전략적)
      { x: 64, y: 45, resources: createMineralLine(56, 42, 6) },
      { x: 64, y: 83, resources: createMineralLine(56, 86, 6) },
      // 측면 확장
      { x: 10, y: 64, resources: createMineralLine(5, 58, 6) },
      { x: 118, y: 64, resources: createMineralLine(108, 58, 6) },
      // 위험한 확장 (용암 근처)
      { x: 35, y: 35, resources: createMineralLine(38, 32, 5) },
      { x: 93, y: 93, resources: createMineralLine(85, 96, 5) },
    ],
    decorations,
  };
}

// ==========================================
// 맵 3: 사막 전초기지 (Desert Outpost)
// ==========================================
function createDesertMap(): GameMap {
  const width = 128;
  const height = 128;
  const terrain = createTerrain(width, height, TerrainType.GROUND);
  
  // 오아시스 (물)
  fillCircle(terrain, 64, 64, 10, TerrainType.WATER);
  fillCircle(terrain, 30, 98, 6, TerrainType.WATER);
  fillCircle(terrain, 98, 30, 6, TerrainType.WATER);
  
  // 협곡/절벽 (지도를 분할)
  // 대각선 협곡
  for (let i = 0; i < 40; i++) {
    fillRect(terrain, 88 + i / 4, i * 2 + 10, 4, 3, TerrainType.CLIFF);
    fillRect(terrain, 36 - i / 4, height - i * 2 - 13, 4, 3, TerrainType.CLIFF);
  }
  
  // 고지대 (메사/언덕)
  fillRect(terrain, 15, 40, 20, 15, TerrainType.HIGH_GROUND);
  fillRect(terrain, 93, 73, 20, 15, TerrainType.HIGH_GROUND);
  fillRect(terrain, 45, 10, 18, 12, TerrainType.HIGH_GROUND);
  fillRect(terrain, 65, 106, 18, 12, TerrainType.HIGH_GROUND);
  
  // 경사로 (고지대 접근)
  fillRect(terrain, 25, 55, 5, 4, TerrainType.RAMP);
  fillRect(terrain, 98, 73, 5, 4, TerrainType.RAMP);
  fillRect(terrain, 52, 22, 4, 5, TerrainType.RAMP);
  fillRect(terrain, 72, 106, 4, 5, TerrainType.RAMP);
  
  // 도로 (사막 횡단로)
  fillRect(terrain, 0, 63, 54, 3, TerrainType.ROAD);
  fillRect(terrain, 74, 63, 54, 3, TerrainType.ROAD);
  fillRect(terrain, 63, 0, 3, 54, TerrainType.ROAD);
  fillRect(terrain, 63, 74, 3, 54, TerrainType.ROAD);
  
  // 장식물
  const decorations: DecoLocation[] = [
    // 선인장/바위
    { x: 20, y: 20, type: DecoType.ROCK },
    { x: 108, y: 20, type: DecoType.ROCK },
    { x: 20, y: 108, type: DecoType.ROCK },
    { x: 108, y: 108, type: DecoType.ROCK },
    // 전초기지 폐허
    { x: 64, y: 45, type: DecoType.RUINS },
    { x: 64, y: 83, type: DecoType.RUINS },
    // 버려진 차량
    { x: 40, y: 64, type: DecoType.VEHICLE_WRECK },
    { x: 88, y: 64, type: DecoType.VEHICLE_WRECK },
    // 보급품 상자
    { x: 64, y: 54, type: DecoType.CRATE },
    { x: 64, y: 74, type: DecoType.CRATE },
  ];
  
  return {
    id: 'desert_outpost',
    name: 'Desert Outpost',
    description: '광활한 사막의 전초기지. 오아시스를 두고 싸우고, 협곡을 활용해 적을 저지하세요.',
    width,
    height,
    tileSize: 32,
    theme: 'desert',
    terrain,
    startLocations: [
      {
        x: 8,
        y: 8,
        resources: createMineralLine(3, 13),
      },
      {
        x: 120,
        y: 120,
        resources: createMineralLine(110, 115),
      },
      {
        x: 120,
        y: 8,
        resources: createMineralLine(110, 13),
      },
      {
        x: 8,
        y: 120,
        resources: createMineralLine(3, 115),
      },
    ],
    expansions: [
      // 오아시스 확장 (중앙, 고가치)
      { x: 64, y: 50, resources: [
        { x: 55, y: 48, type: 'minerals', amount: 2000 },
        { x: 56, y: 48, type: 'minerals', amount: 2000 },
        { x: 57, y: 48, type: 'minerals', amount: 2000 },
        { x: 58, y: 48, type: 'minerals', amount: 2000 },
        { x: 60, y: 48, type: 'gas', amount: 3000 },
      ]},
      { x: 64, y: 78, resources: [
        { x: 68, y: 80, type: 'minerals', amount: 2000 },
        { x: 69, y: 80, type: 'minerals', amount: 2000 },
        { x: 70, y: 80, type: 'minerals', amount: 2000 },
        { x: 71, y: 80, type: 'minerals', amount: 2000 },
        { x: 73, y: 80, type: 'gas', amount: 3000 },
      ]},
      // 고지대 확장
      { x: 25, y: 45, resources: createMineralLine(17, 43, 5) },
      { x: 103, y: 80, resources: createMineralLine(95, 78, 5) },
      // 측면 확장
      { x: 8, y: 64, resources: createMineralLine(3, 68, 6) },
      { x: 120, y: 64, resources: createMineralLine(110, 68, 6) },
    ],
    decorations,
  };
}

// ==========================================
// 맵 레지스트리
// ==========================================
export const GAME_MAPS: Record<string, GameMap> = {
  city_warfare: createCityMap(),
  volcanic_highlands: createMountainMap(),
  desert_outpost: createDesertMap(),
};

export const MAP_LIST = Object.values(GAME_MAPS);

export function getMap(id: string): GameMap | undefined {
  return GAME_MAPS[id];
}

export function getRandomMap(): GameMap {
  const maps = MAP_LIST;
  return maps[Math.floor(Math.random() * maps.length)];
}

// 지형이 이동 가능한지 확인
export function isWalkable(terrainType: TerrainType): boolean {
  return terrainType === TerrainType.GROUND ||
         terrainType === TerrainType.HIGH_GROUND ||
         terrainType === TerrainType.ROAD ||
         terrainType === TerrainType.BRIDGE ||
         terrainType === TerrainType.RAMP;
}

// 지형의 이동 속도 배율
export function getTerrainSpeedMultiplier(terrainType: TerrainType): number {
  switch (terrainType) {
    case TerrainType.ROAD:
      return 1.3; // 30% 빠름
    case TerrainType.HIGH_GROUND:
      return 0.9; // 10% 느림
    case TerrainType.RAMP:
      return 0.8; // 20% 느림
    default:
      return 1.0;
  }
}

// 지형이 고지대인지 확인
export function isHighGround(terrainType: TerrainType): boolean {
  return terrainType === TerrainType.HIGH_GROUND;
}
