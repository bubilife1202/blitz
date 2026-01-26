// ==========================================
// GameScene - 메인 게임 씬
// ==========================================

import Phaser from 'phaser';
import { GameState } from '@core/GameState';
import { GameLoop } from '@core/GameLoop';
import { LocalHost } from '@host/LocalHost';
import { PathfindingService } from '@core/PathfindingService';

import { MovementSystem } from '@core/systems/MovementSystem';
import { GatherSystem } from '@core/systems/GatherSystem';
import { ProductionSystem } from '@core/systems/ProductionSystem';
import { CombatSystem } from '@core/systems/CombatSystem';
import { ConstructionSystem } from '@core/systems/ConstructionSystem';
import { BuilderSystem } from '@core/systems/BuilderSystem';
import { HealSystem } from '@core/systems/HealSystem';
import { VisionSystem } from '@core/systems/VisionSystem';
import { ResearchSystem } from '@core/systems/ResearchSystem';
import { DefenseSystem } from '@core/systems/DefenseSystem';
import { AIController } from '@core/AIController';
import { UnitRenderer } from '../renderer/UnitRenderer';
import { BuildingRenderer } from '../renderer/BuildingRenderer';
import { ResourceRenderer } from '../renderer/ResourceRenderer';
import { FogRenderer } from '../renderer/FogRenderer';
import { EffectsRenderer } from '../renderer/EffectsRenderer';
import type { Entity } from '@core/ecs/Entity';
import { SelectionManager } from '../input/SelectionManager';
import { CommandManager } from '../input/CommandManager';
import { BuildingPlacer } from '../input/BuildingPlacer';
import { Minimap } from '../ui/Minimap';
import { HUD } from '../ui/HUD';
import { PauseMenu } from '../ui/PauseMenu';
import { PromptInput } from '../ui/PromptInput';
import { Position } from '@core/components/Position';
import { Owner } from '@core/components/Owner';
import { Building } from '@core/components/Building';
import { ProductionQueue } from '@core/components/ProductionQueue';
import { Unit } from '@core/components/Unit';
import { Race, BuildingType, UnitType, UpgradeType, AIDifficulty, type PlayerId } from '@shared/types';
import { UNIT_STATS, UPGRADE_STATS, BUILDING_STATS, canTrainUnit, secondsToTicks } from '@shared/constants';
import { ResearchQueue } from '@core/components/ResearchQueue';
import { combatEvents } from '@core/events/CombatEvents';
import { soundManager } from '../audio/SoundManager';
import { PlayerDirector } from '@core/PlayerDirector';
import { DirectorPanel } from '../ui/DirectorPanel';
import { PlanFeed } from '../ui/PlanFeed';
import { ReportFeed } from '../ui/ReportFeed';
import { StrategyEditor } from '../ui/StrategyEditor';
import { NetworkClient, NetworkEvent } from '@core/network/NetworkClient';
import { CommandExecutor } from '@core/commands/CommandExecutor';
import type { GameCommand } from '@shared/types';

interface GameSceneData {
  mode: 'single' | 'multi';
  difficulty?: AIDifficulty;
  aiCount?: number;
  seed?: number;
  // 멀티플레이용
  isHost?: boolean;
  playerId?: number;
}

export class GameScene extends Phaser.Scene {
  private gameState!: GameState;
  private gameLoop!: GameLoop;
  private localHost!: LocalHost;
  private pathfinding!: PathfindingService;
  private localPlayerId: PlayerId = 1;
  
  // 렌더러
  private unitRenderer!: UnitRenderer;
  private buildingRenderer!: BuildingRenderer;
  private resourceRenderer!: ResourceRenderer;
  private fogRenderer!: FogRenderer;
  private effectsRenderer!: EffectsRenderer;
  
  // 시야 시스템 참조 (FogRenderer용)
  private visionSystem!: VisionSystem;
  
  // 입력 매니저
  private selectionManager!: SelectionManager;
  public commandManager!: CommandManager;
  private buildingPlacer!: BuildingPlacer;
  
  // UI
  private minimap!: Minimap;
  private hud!: HUD;
  private pauseMenu!: PauseMenu;
  private promptInput?: PromptInput;
  private gameOverText!: Phaser.GameObjects.Text;
  private isPaused: boolean = false;
  private aiDifficulty: AIDifficulty = AIDifficulty.NORMAL;
  private aiCount: number = 1;
  private aiControllers: AIController[] = [];
  
  // 감독 모드
  private playerDirector?: PlayerDirector;
  private directorPanel?: DirectorPanel;
  private planFeed?: PlanFeed;
  private reportFeed?: ReportFeed;
  private strategyEditor?: StrategyEditor;
  
  // 카메라 드래그
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private dragStartY: number = 0;

  // 방향키 카메라 이동
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private cameraZoom: number = 1;
  private lockCameraZoom: boolean = true;
  private mapRevealEnabled: boolean = false;
  private mapSeed: number = 0;

  private completionTrackingReady: boolean = false;
  private completedBuildings: Set<number> = new Set();
  private knownUnits: Set<number> = new Set();
  private lastUnitCompleteTime: number = 0;
  private lastBuildingCompleteTime: number = 0;
  
  // 멀티플레이
  private isMultiplayer: boolean = false;
  private network?: NetworkClient;
  private commandExecutor?: CommandExecutor;
  private networkCommandHandler?: (command: GameCommand) => void;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData): void {
    console.log('GameScene init:', data);
    
    this.isMultiplayer = data.mode === 'multi';
    
    if (this.isMultiplayer) {
      // 멀티플레이: playerId는 LobbyScene에서 전달받음
      this.localPlayerId = (data.playerId || 1) as PlayerId;
      this.aiCount = 0; // 멀티에서는 AI 없음
      this.network = NetworkClient.getInstance();
    } else {
      // 싱글플레이
      this.localPlayerId = 1;
      this.aiCount = data.aiCount || 1;
      this.network = undefined;
    }
    
    this.aiDifficulty = data.difficulty || AIDifficulty.NORMAL;
    this.mapSeed = data.seed ?? Date.now();
  }

  create(): void {
    console.time('🎮 GameScene.create TOTAL');
    
    console.time('1️⃣ Core init (GameState, Pathfinding, LocalHost)');
    // 게임 상태 초기화
    this.gameState = new GameState();
    
    // 패스파인딩 서비스 초기화
    this.pathfinding = new PathfindingService(this.gameState.config);
    
    // 로컬 호스트 초기화
    this.localHost = new LocalHost(this.gameState, this.pathfinding);
    this.localHost.setAICount(this.aiCount);
    
    // 플레이어 추가
    this.gameState.addPlayer(1, Race.VANGUARD);
    if (this.aiCount > 0) {
      // 싱글플레이: AI 추가
      for (let i = 0; i < this.aiCount; i++) {
        this.gameState.addPlayer(2 + i, Race.VANGUARD);
      }
    } else {
      // 멀티플레이: 상대 플레이어 추가
      this.gameState.addPlayer(2, Race.VANGUARD);
    }
    console.timeEnd('1️⃣ Core init (GameState, Pathfinding, LocalHost)');
    
    console.time('2️⃣ Systems registration');
    // 시스템 등록 (우선순위 순서)
    this.visionSystem = new VisionSystem();
    this.gameState.addSystem(this.visionSystem); // 시야 시스템 (먼저)
    this.gameState.addSystem(new MovementSystem());
    this.gameState.addSystem(new GatherSystem());
    
    // BuilderSystem (SCV 건설 처리) - ConstructionSystem 전에 실행
    const builderSystem = new BuilderSystem();
    builderSystem.setPathfindingService(this.pathfinding);
    this.gameState.addSystem(builderSystem);
    
    this.gameState.addSystem(new ConstructionSystem());
    this.gameState.addSystem(new ProductionSystem());
    this.gameState.addSystem(new ResearchSystem()); // 연구 시스템
    this.gameState.addSystem(new HealSystem()); // 메딕 치료 시스템
    this.gameState.addSystem(new DefenseSystem()); // 방어 건물 공격 시스템
    this.gameState.addSystem(new CombatSystem());
    console.timeEnd('2️⃣ Systems registration');
    
    console.time('3️⃣ AI Controllers');
    // AI 컨트롤러들 (패스파인딩 연결)
    this.aiControllers = [];
    for (let i = 0; i < this.aiCount; i++) {
      const aiPlayerId = 2 + i;
      const controller = new AIController(this.gameState, aiPlayerId, this.pathfinding, this.aiDifficulty);
      this.aiControllers.push(controller);
    }
    console.timeEnd('3️⃣ AI Controllers');
    
    // 게임 루프 초기화
    this.gameLoop = new GameLoop(this.gameState, {
      onTick: (tick) => {
        this.onGameTick(tick);
      },
    });

    console.time('4️⃣ renderMap()');
    // 맵 렌더링
    this.renderMap();
    console.timeEnd('4️⃣ renderMap()');
    
    // 렌더러 초기화 (시야 시스템 연결)
    this.unitRenderer = new UnitRenderer(this, this.localPlayerId, this.visionSystem);
    this.buildingRenderer = new BuildingRenderer(this, this.localPlayerId, this.visionSystem);
    this.resourceRenderer = new ResourceRenderer(this);
    this.fogRenderer = new FogRenderer(this, this.visionSystem, this.localPlayerId);
    this.effectsRenderer = new EffectsRenderer(this);

    this.applyMapVisibilityMode();
    
    // 입력 매니저 초기화
    this.selectionManager = new SelectionManager(this, this.gameState, this.localPlayerId);
    this.selectionManager.onHoverChange = (entityId) => {
      this.unitRenderer.setHoveredEntity(entityId);
    };
    this.commandManager = new CommandManager(
      this,
      this.gameState,
      this.selectionManager,
      this.pathfinding,
      this.localPlayerId
    );
    
    // 멀티플레이 명령 동기화 설정
    if (this.isMultiplayer && this.network) {
      this.commandExecutor = new CommandExecutor(this.gameState, this.pathfinding);
      
      // 로컬 명령 → 네트워크로 전송
      this.commandManager.onCommand = (command: GameCommand) => {
        this.network?.sendCommand(command);
      };
      
      // 원격 명령 수신 → 실행
      this.networkCommandHandler = (command: GameCommand) => {
        // 자기 명령은 이미 로컬에서 실행됨, 상대 명령만 실행
        if (command.playerId !== this.localPlayerId) {
          this.commandExecutor?.execute(command);
        }
      };
      this.network.on(NetworkEvent.COMMAND, this.networkCommandHandler);
    }
    
    // 건물 배치 매니저 초기화
    this.buildingPlacer = new BuildingPlacer(
      this,
      this.gameState,
      this.pathfinding,
      this.selectionManager,
      this.localPlayerId
    );

    // 초기 유닛/건물 배치
    this.localHost.setupInitialEntities();
    
    // 카메라 드래그 입력 설정
    this.setupCameraInput();
    
    // 미니맵 설정 (200x200으로 확대)
    this.minimap = new Minimap(
      this,
      this.gameState,
      10,
      this.scale.height - 210,
      200,
      200
    );
    this.minimap.onMinimapClick = (x, y) => {
      this.cameras.main.centerOn(x, y);
    };
    
    // HUD 설정
    this.hud = new HUD(this, this.gameState, this.selectionManager);
    this.hud.setLocalPlayerId(this.localPlayerId);
    this.hud.onBuildCommand = (buildingType: BuildingType) => {
      this.buildingPlacer.startPlacement(buildingType);
    };
    this.hud.onTrainCommand = (unitType: UnitType) => {
      this.trainUnit(unitType);
    };
    this.hud.onSiegeCommand = () => {
      this.toggleSiegeMode();
    };
    this.hud.onStimCommand = () => {
      this.activateStimPack();
    };
    this.hud.onResearchCommand = (upgradeType: UpgradeType) => {
      this.startResearch(upgradeType);
    };
    
    // 카메라 설정
    this.setupCamera();
    
    // 초기 시야 및 렌더링 실행 (Restart 후 화면 표시 문제 해결)
    // VisionSystem을 먼저 업데이트해야 시야가 계산됨
    const entities = this.gameState.getAllEntities();
    const entitiesWithOwner = entities.filter(e => 
      e.getComponent<Position>(Position) && e.getComponent<Owner>(Owner)
    );
    this.visionSystem.update(entitiesWithOwner, this.gameState, 0);
    
    // 렌더러 초기화
    this.unitRenderer.updateEntities(entities);
    this.buildingRenderer.updateEntities(entities);
    this.resourceRenderer.updateEntities(entities);
    this.fogRenderer.update();
    this.minimap.update();
    
    // 게임 오버 텍스트 (숨김)
    this.gameOverText = this.add.text(
      this.scale.width / 2,
      this.scale.height / 2,
      '',
      { fontSize: '48px', color: '#ffffff', backgroundColor: '#000000' }
    );
    this.gameOverText.setOrigin(0.5);
    this.gameOverText.setScrollFactor(0);
    this.gameOverText.setDepth(5000);
    this.gameOverText.setVisible(false);
    
    // 일시정지 메뉴 설정
    this.pauseMenu = new PauseMenu(this);
    this.pauseMenu.onResume = () => this.resumeGame();
    this.pauseMenu.onRestart = () => this.restartGame();
    this.pauseMenu.onMainMenu = () => this.goToMainMenu();
    this.pauseMenu.onSettings = () => {
      // 설정 메뉴 (추후 구현)
      console.log('Settings - not implemented yet');
    };

    // 프롬프트 입력창 설정
    this.promptInput = new PromptInput(
      this,
      this.gameState,
      this.selectionManager,
      this.commandManager,
      this.buildingPlacer
    );
    this.promptInput.setLocalPlayerId(this.localPlayerId);
    this.promptInput.onTrainUnit = (unitType: UnitType) => {
      this.trainUnit(unitType);
    };
    this.promptInput.onTogglePause = () => {
      this.togglePause();
    };
    
    // 감독 모드 설정
      this.playerDirector = new PlayerDirector(this.gameState, this.localPlayerId, this.pathfinding);
      
      this.directorPanel = new DirectorPanel(this);
      this.directorPanel.onSettingsChange = (settings) => {
        this.playerDirector?.setSettings(settings);
      };
      this.directorPanel.onMapRevealToggle = (enabled) => {
        this.setMapRevealEnabled(enabled);
      };
      this.directorPanel.onStrategySelect = (strategyId) => {
        this.playerDirector?.selectStrategy(strategyId);
      };
      this.directorPanel.onEditStrategy = () => {
        const currentStrategy = this.playerDirector?.getCurrentStrategy();
        if (currentStrategy) {
          this.strategyEditor?.show(currentStrategy);
        }
      };
      
      this.planFeed = new PlanFeed(this);
      this.planFeed.onApprovalResponse = (_requestId, optionId) => {
        this.playerDirector?.respondToApproval(optionId);
      };
      
      this.reportFeed = new ReportFeed(this);
      
      // 전략 편집기
      this.strategyEditor = new StrategyEditor(this);
      this.strategyEditor.onSave = (strategy, isNew) => {
        if (isNew) {
          this.playerDirector?.addStrategy(strategy);
        } else {
          this.playerDirector?.updateStrategy(strategy.id, strategy);
        }
      };
    this.strategyEditor.onDelete = (strategyId) => {
      this.playerDirector?.deleteStrategy(strategyId);
    };
    
    // 전투 이벤트 구독 (이펙트 연동)
    this.setupCombatEventListeners();
    
    // 게임 시작
    this.gameLoop.start();

    this.input.once('pointerdown', () => {
      soundManager.resume();
      soundManager.startAmbient();
    });
    
    console.log('Game started!');
  }

  update(_time: number, _delta: number): void {
    if (this.gameState.isGameOver()) return;
    if (this.isPaused) return;
    
    // 패스파인딩 계산 처리
    this.pathfinding.update();
    
    // 엔티티 렌더링 업데이트
    const entities = this.gameState.getAllEntities();
    this.handleCompletionSounds(entities);
    this.unitRenderer.updateEntities(entities);
    this.buildingRenderer.updateEntities(entities);
    this.resourceRenderer.updateEntities(entities);
    
    // 미니맵 업데이트
    this.minimap.update();
    
    // 안개 전쟁 업데이트
    this.fogRenderer.update();
    
    // 이펙트 업데이트
    this.effectsRenderer.update();
    
    // HUD 업데이트
    this.hud.update();
    
    // 감독 모드 UI 업데이트
    if (this.playerDirector && this.directorPanel && this.planFeed) {
      const planSnapshot = this.playerDirector.getPlanSnapshot();
      this.directorPanel.update(planSnapshot);
      this.planFeed.update(planSnapshot);
      this.reportFeed?.update(planSnapshot);
    }
    
    // 카메라 업데이트
    this.updateCamera();
    
    // 승리/패배 체크
    this.checkGameOver();
  }

  // 게임 틱 콜백
  private onGameTick(tick: number): void {
    // AI 업데이트 (10틱마다)
    if (tick % 10 === 0) {
      for (const ai of this.aiControllers) {
        ai.update();
      }
    }
    
    // 플레이어 감독 모드 업데이트 (매 틱)
    this.playerDirector?.update();
  }

  // ==========================================
  // 일시정지 관련 메서드
  // ==========================================

  private togglePause(): void {
    if (this.isPaused) {
      this.resumeGame();
    } else {
      this.pauseGame();
    }
  }

  private pauseGame(): void {
    this.isPaused = true;
    this.gameLoop.stop();
    this.commandManager.setPaused(true);
    this.pauseMenu.show();
  }

  private resumeGame(): void {
    this.isPaused = false;
    this.commandManager.setPaused(false);
    this.pauseMenu.hide();
    this.gameLoop.start();
  }

  private restartGame(): void {
    this.gameLoop.stop();
    this.scene.restart({ mode: 'single', difficulty: this.aiDifficulty });
  }

  private goToMainMenu(): void {
    this.gameLoop.stop();
    this.scene.start('MenuScene');
  }

  // 맵 렌더링 (Phaser Tilemap 사용 - GPU 최적화)
  private renderMap(): void {
    const { mapWidth, mapHeight, tileSize } = this.gameState.config;
    const tileCount = this.registry.get('mapTileCount') || 28;
    
    // 타일맵 생성을 위한 RNG (결정론적 맵 생성)
    const rng = new Phaser.Math.RandomDataGenerator([this.mapSeed.toString()]);
    
    // 2D 타일 데이터 배열 생성 (랜덤 타일 인덱스)
    const mapData: number[][] = [];
    for (let y = 0; y < mapHeight; y++) {
      mapData[y] = [];
      for (let x = 0; x < mapWidth; x++) {
        mapData[y][x] = rng.between(0, tileCount - 1);
      }
    }
    
    // Phaser Tilemap 생성
    const map = this.make.tilemap({
      data: mapData,
      tileWidth: tileSize,
      tileHeight: tileSize
    });
    
    // BootScene에서 미리 생성한 타일셋 사용
    const tileset = map.addTilesetImage('map_tileset', 'map_tileset', tileSize, tileSize, 0, 0);
    if (!tileset) {
      console.error('Failed to load map_tileset');
      return;
    }
    
    // 레이어 생성 (GPU 배칭으로 빠름)
    const layer = map.createLayer(0, tileset, 0, 0);
    if (layer) {
      layer.setDepth(0);
      // 배경을 어둡게 (66% 밝기) - 유닛을 돋보이게 함
      layer.setTint(0xaaaaaa);
    }
  }

  // 카메라 드래그 입력
  private setupCameraInput(): void {
    // 방향키 커서 생성
    this.cursors = this.input.keyboard!.createCursorKeys();

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonDown()) {
        this.isDragging = true;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dx = this.dragStartX - pointer.x;
        const dy = this.dragStartY - pointer.y;
        this.cameras.main.scrollX += dx;
        this.cameras.main.scrollY += dy;
        this.dragStartX = pointer.x;
        this.dragStartY = pointer.y;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.middleButtonReleased()) {
        this.isDragging = false;
      }
    });
    
    if (!this.lockCameraZoom) {
      this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gameObjects: unknown[], _deltaX: number, deltaY: number) => {
        const zoomSpeed = 0.1;
        if (deltaY > 0) {
          this.cameraZoom = Math.max(0.5, this.cameraZoom - zoomSpeed);
        } else {
          this.cameraZoom = Math.min(2, this.cameraZoom + zoomSpeed);
        }
        this.cameras.main.setZoom(this.cameraZoom);
      });
    } else {
      this.cameraZoom = 1;
      this.cameras.main.setZoom(this.cameraZoom);
    }

    // 키보드 단축키
    // ESC는 프롬프트 닫기에도 사용되므로 별도 처리
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.promptInput?.isOpen()) return; // 프롬프트 열려있으면 무시
      // 게임 오버 상태면 메인 메뉴로
      if (this.gameState.isGameOver()) {
        this.goToMainMenu();
      } else {
        this.togglePause();
      }
    });
    
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (this.promptInput?.isOpen()) return;
      const selected = this.selectionManager.getSelectedEntities();
      if (selected.length > 0) {
        const pos = selected[0].getComponent<Position>(Position);
        if (pos) {
          this.cameras.main.centerOn(pos.x, pos.y);
        }
      }
    });

    // 건물 건설 단축키 (SCV 선택시)
    this.input.keyboard?.on('keydown-B', () => {
      if (this.promptInput?.isOpen()) return;
      this.buildingPlacer.startPlacement(BuildingType.BARRACKS);
    });
    this.input.keyboard?.on('keydown-D', () => {
      if (this.promptInput?.isOpen()) return;
      this.buildingPlacer.startPlacement(BuildingType.DEPOT);
    });
    this.input.keyboard?.on('keydown-C', () => {
      if (this.promptInput?.isOpen()) return;
      this.buildingPlacer.startPlacement(BuildingType.HQ);
    });
    this.input.keyboard?.on('keydown-E', () => {
      if (this.promptInput?.isOpen()) return;
      this.buildingPlacer.startPlacement(BuildingType.TECH_LAB);
    });
    this.input.keyboard?.on('keydown-F', () => {
      if (this.promptInput?.isOpen()) return;
      this.buildingPlacer.startPlacement(BuildingType.FACTORY);
    });
    this.input.keyboard?.on('keydown-R', () => {
      if (this.promptInput?.isOpen()) return;
      this.buildingPlacer.startPlacement(BuildingType.ARMORY);
    });
    
    // Siege Tank 시즈 모드 토글
    this.input.keyboard?.on('keydown-O', () => {
      if (this.promptInput?.isOpen()) return;
      this.toggleSiegeMode();
    });
    
    // Stim Pack 활성화
    this.input.keyboard?.on('keydown-T', () => {
      if (this.promptInput?.isOpen()) return;
      this.activateStimPack();
    });
    
    // 유닛 생산 단축키 (건물이 선택되었을 때만 작동)
    this.input.keyboard?.on('keydown-S', () => {
      if (this.promptInput?.isOpen()) return;
      if (this.hasProductionBuildingSelected()) {
        this.trainUnit(UnitType.ENGINEER);
      }
    });
    this.input.keyboard?.on('keydown-M', () => {
      if (this.promptInput?.isOpen()) return;
      if (this.hasProductionBuildingSelected()) {
        this.trainUnit(UnitType.TROOPER);
      }
    });
    this.input.keyboard?.on('keydown-I', () => {
      if (this.promptInput?.isOpen()) return;
      if (this.hasProductionBuildingSelected()) {
        this.trainUnit(UnitType.PYRO);
      }
    });
    this.input.keyboard?.on('keydown-H', () => {
      if (this.promptInput?.isOpen()) return;
      if (this.hasProductionBuildingSelected()) {
        this.trainUnit(UnitType.MEDIC);
      }
    });
    this.input.keyboard?.on('keydown-V', () => {
      if (this.promptInput?.isOpen()) return;
      if (this.hasProductionBuildingSelected()) {
        this.trainUnit(UnitType.SPEEDER);
      }
    });
    this.input.keyboard?.on('keydown-G', () => {
      if (this.promptInput?.isOpen()) return;
      if (this.hasProductionBuildingSelected()) {
        this.trainUnit(UnitType.WALKER);
      }
    });
    this.input.keyboard?.on('keydown-K', () => {
      if (this.promptInput?.isOpen()) return;
      if (this.hasProductionBuildingSelected()) {
        this.trainUnit(UnitType.ARTILLERY);
      }
    });

    this.input.keyboard?.on('keydown-Z', () => {
      if (this.promptInput?.isOpen()) return;
      this.toggleMapReveal();
    });
  }

  // 카메라 설정
  private setupCamera(): void {
    const { mapWidth, mapHeight, tileSize } = this.gameState.config;
    
    this.cameras.main.setBounds(0, 0, mapWidth * tileSize, mapHeight * tileSize);
    this.cameras.main.setZoom(this.cameraZoom);
    // 플레이어 1 베이스 중심 (커맨드센터 위치: 6*32, 8*32)
    this.cameras.main.centerOn(6 * tileSize, 8 * tileSize);
  }

  private applyMapVisibilityMode(): void {
    this.visionSystem.setRevealAll(this.mapRevealEnabled);
    this.visionSystem.setShowExplored(this.mapRevealEnabled);
  }

  public setMapRevealEnabled(enabled: boolean): void {
    this.mapRevealEnabled = enabled;
    this.applyMapVisibilityMode();
    console.log(`Map reveal: ${this.mapRevealEnabled ? 'ON' : 'OFF (vision only)'}`);
  }

  private toggleMapReveal(): void {
    this.setMapRevealEnabled(!this.mapRevealEnabled);
  }

  // 카메라 업데이트 (방향키 + 엣지 스크롤)
  private updateCamera(): void {
    const camera = this.cameras.main;
    const baseSpeed = 16;
    const scrollSpeed = baseSpeed / this.cameraZoom; // 줌 레벨에 따라 속도 조절

    // 방향키 카메라 이동
    if (this.cursors.left.isDown) {
      camera.scrollX -= scrollSpeed;
    }
    if (this.cursors.right.isDown) {
      camera.scrollX += scrollSpeed;
    }
    if (this.cursors.up.isDown) {
      camera.scrollY -= scrollSpeed;
    }
    if (this.cursors.down.isDown) {
      camera.scrollY += scrollSpeed;
    }

    // 엣지 스크롤 (마우스 드래그 중이 아닐 때만)
    if (!this.isDragging) {
      const pointer = this.input.activePointer;
      const edgeSize = 30;
      const edgeScrollSpeed = 14 / this.cameraZoom;

      // 마우스가 게임 캔버스 안에 있을 때만 엣지 스크롤
      if (pointer.x >= 0 && pointer.x <= this.scale.width &&
          pointer.y >= 0 && pointer.y <= this.scale.height) {
        
        // 좌우 엣지
        if (pointer.x < edgeSize) {
          const factor = 1 - (pointer.x / edgeSize); // 가장자리에 가까울수록 빠르게
          camera.scrollX -= edgeScrollSpeed * factor;
        } else if (pointer.x > this.scale.width - edgeSize) {
          const factor = 1 - ((this.scale.width - pointer.x) / edgeSize);
          camera.scrollX += edgeScrollSpeed * factor;
        }

        // 상하 엣지
        if (pointer.y < edgeSize) {
          const factor = 1 - (pointer.y / edgeSize);
          camera.scrollY -= edgeScrollSpeed * factor;
        } else if (pointer.y > this.scale.height - edgeSize) {
          const factor = 1 - ((this.scale.height - pointer.y) / edgeSize);
          camera.scrollY += edgeScrollSpeed * factor;
        }
      }
    }
  }

  // 승리/패배 체크
  private checkGameOver(): void {
    const player1Units = this.countPlayerEntities(1);
    const player2Units = this.countPlayerEntities(2);

    if (player1Units === 0 && player2Units > 0) {
      this.endGame(2, 'DEFEAT');
    } else if (player2Units === 0 && player1Units > 0) {
      this.endGame(1, 'VICTORY');
    }
  }

  private countPlayerEntities(playerId: number): number {
    return this.gameState.getAllEntities().filter(e => {
      const owner = e.getComponent<Owner>(Owner);
      return owner && owner.playerId === playerId;
    }).length;
  }

  private endGame(_winnerId: number, result: string): void {
    this.gameState.endGame(_winnerId);
    this.gameLoop.stop();

    this.gameOverText.setText(`${result}\n\nPress ESC to return to menu`);
    this.gameOverText.setVisible(true);
  }

  // 플레이어가 보유한 건물 타입 목록 가져오기
  private getPlayerBuildingTypes(): BuildingType[] {
    const types: BuildingType[] = [];
    for (const entity of this.gameState.getAllEntities()) {
      const owner = entity.getComponent<Owner>(Owner);
      const building = entity.getComponent<Building>(Building);
      if (owner?.playerId === 1 && building && !building.isConstructing) {
        if (!types.includes(building.buildingType)) {
          types.push(building.buildingType);
        }
      }
    }
    return types;
  }

  // 선택된 것이 생산 가능한 건물인지 확인
  private hasProductionBuildingSelected(): boolean {
    const selected = this.selectionManager.getSelectedEntities();
    if (selected.length === 0) return false;
    const entity = selected[0];
    const building = entity.getComponent<Building>(Building);
    const queue = entity.getComponent<ProductionQueue>(ProductionQueue);
    return !!building && !!queue && !building.isConstructing;
  }

  // 유닛 생산
  private trainUnit(unitType: UnitType): void {
    console.log('=== trainUnit called ===', unitType);

    const selected = this.selectionManager.getSelectedEntities();
    if (selected.length === 0) {
      console.log('No selection');
      return;
    }

    const entity = selected[0];
    const building = entity.getComponent<Building>(Building);
    const queue = entity.getComponent<ProductionQueue>(ProductionQueue);

    console.log('Building:', building?.buildingType, 'Queue:', !!queue, 'Constructing:', building?.isConstructing);

    if (!building || !queue || building.isConstructing) {
      console.log('Cannot train: no building, no queue, or constructing');
      return;
    }

    // 건물이 해당 유닛을 생산할 수 있는지 확인
    const buildingStats = BUILDING_STATS[building.buildingType];
    if (!buildingStats.canProduce || !buildingStats.canProduce.includes(unitType)) {
      console.log(`Building ${building.buildingType} cannot produce ${unitType}`);
      return;
    }

    // 테크 트리 요구사항 확인 (예: Siege Tank → Armory 필요)
    const playerBuildings = this.getPlayerBuildingTypes();
    if (!canTrainUnit(unitType, playerBuildings)) {
      console.log(`Missing required building for ${unitType}`);
      return;
    }

    // 자원 확인
    const stats = UNIT_STATS[unitType];
    const resources = this.gameState.getPlayerResources(1);
    if (!resources) return;

    if (resources.minerals < stats.mineralCost) {
      console.log('Not enough minerals!');
      return;
    }
    if (resources.gas < stats.gasCost) {
      console.log('Not enough gas!');
      return;
    }
    if (resources.supply + stats.supplyCost > resources.supplyMax) {
      console.log('Not enough supply!');
      return;
    }

    // 자원 차감 및 생산 큐 추가
    this.gameState.modifyPlayerResources(1, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
    queue.addToQueue(unitType, secondsToTicks(stats.buildTime));

    console.log(`Training ${unitType}`);
  }

  // 업그레이드 연구
  private startResearch(upgradeType: UpgradeType): void {
    console.log('=== startResearch called ===', upgradeType);

    const selected = this.selectionManager.getSelectedEntities();
    if (selected.length === 0) {
      console.log('No selection');
      return;
    }

    const entity = selected[0];
    const building = entity.getComponent<Building>(Building);
    let researchQueue = entity.getComponent<ResearchQueue>(ResearchQueue);

    if (!building || building.isConstructing) {
      console.log('Cannot research: no building or constructing');
      return;
    }

    // ResearchQueue가 없으면 추가
    if (!researchQueue) {
      researchQueue = new ResearchQueue();
      entity.addComponent(researchQueue);
    }

    // 이미 연구 중인지 확인
    if (researchQueue.isResearching()) {
      console.log('Already researching!');
      return;
    }

    // 자원 확인
    const stats = UPGRADE_STATS[upgradeType];
    const resources = this.gameState.getPlayerResources(1);
    if (!resources) return;

    if (resources.minerals < stats.mineralCost) {
      console.log('Not enough minerals!');
      return;
    }
    if (resources.gas < stats.gasCost) {
      console.log('Not enough gas!');
      return;
    }

    // 자원 차감 및 연구 시작
    this.gameState.modifyPlayerResources(1, {
      minerals: -stats.mineralCost,
      gas: -stats.gasCost,
    });
    researchQueue.startResearch(upgradeType, secondsToTicks(stats.researchTime));

    console.log(`Researching ${upgradeType}`);
  }

  // Siege Tank 시즈 모드 토글
  private toggleSiegeMode(): void {
    const selected = this.selectionManager.getSelectedEntities();
    
    for (const entity of selected) {
      const unit = entity.getComponent<Unit>(Unit);
      if (unit?.unitType === UnitType.ARTILLERY) {
        const wasSieged = unit.isSieged;
        unit.toggleSiege();
        soundManager.play(wasSieged ? 'siege_off' : 'siege_on');
        console.log(`Siege Tank ${unit.isSieged ? 'sieged' : 'unsieged'}`);
      }
    }
  }

  // Stim Pack 활성화
  private activateStimPack(): void {
    const selected = this.selectionManager.getSelectedEntities();
    
    for (const entity of selected) {
      const unit = entity.getComponent<Unit>(Unit);
      if (unit && (unit.unitType === UnitType.TROOPER || unit.unitType === UnitType.PYRO)) {
        if (unit.activateStim()) {
          soundManager.play('stim');
          console.log(`${unit.unitType} stimmed!`);
        }
      }
    }
  }

  // 씬 종료시 정리
  shutdown(): void {
    this.gameLoop.stop();
    
    // 이벤트 리스너 정리 (중복 등록 방지)
    combatEvents.clear();
    
    // 네트워크 이벤트 리스너 정리
    if (this.network && this.networkCommandHandler) {
      this.network.off(NetworkEvent.COMMAND, this.networkCommandHandler);
    }
    
    this.unitRenderer.destroy();
    this.buildingRenderer.destroy();
    this.resourceRenderer.destroy();
    this.fogRenderer.destroy();
    this.effectsRenderer.destroy();
    this.minimap.destroy();
    this.hud.destroy();
    this.pauseMenu.destroy();
    this.promptInput?.destroy();
    this.planFeed?.destroy();
    this.reportFeed?.destroy();
    this.directorPanel?.destroy();
    this.buildingPlacer.destroy();
    soundManager.stopAmbient();
  }

  // 외부에서 이펙트 접근 (CombatSystem 연동용)
  getEffectsRenderer(): EffectsRenderer {
    return this.effectsRenderer;
  }

  // 전투 이벤트 리스너 설정
  private setupCombatEventListeners(): void {
    // 공격 이벤트 → 프로젝타일 생성 + 사운드
    combatEvents.onAttack((event) => {
      this.effectsRenderer.createProjectile(
        event.attackerX,
        event.attackerY,
        event.targetX,
        event.targetY,
        event.projectileType
      );
      // 사운드 재생
      if (event.projectileType === 'flame') {
        soundManager.play('attack_flame');
      } else if (event.projectileType === 'missile') {
        soundManager.play('attack_missile');
      } else {
        soundManager.play('attack_bullet');
      }
    });

    // 죽음 이벤트 → 죽음 이펙트 생성 + 사운드
    combatEvents.onDeath((event) => {
      this.effectsRenderer.createDeathEffect(
        event.x,
        event.y,
        event.size,
        event.isBuilding
      );
      // 사운드 재생
      if (event.isBuilding) {
        soundManager.play('explosion_large');
      } else {
        soundManager.play('death');
      }
    });

    // 치유 이벤트 → 치유 프로젝타일 생성 + 사운드
    combatEvents.onHeal((event) => {
      this.effectsRenderer.createProjectile(
        event.healerX,
        event.healerY,
        event.targetX,
        event.targetY,
        'heal'
      );
      soundManager.play('heal');
    });

    // 히트 이벤트 → 히트 스파크 생성
    combatEvents.onHit((event) => {
      const intensity = event.isBuilding ? 1.5 : 1;
      this.effectsRenderer.createHitSpark(event.x, event.y, intensity);
      // 히트 사운드 (가끔만 재생하여 과부하 방지)
      if (Math.random() < 0.3) {
        soundManager.play('hit');
      }
    });
  }

  private handleCompletionSounds(entities: Entity[]): void {
    if (!this.completionTrackingReady) {
      for (const entity of entities) {
        const building = entity.getComponent<Building>(Building);
        if (building && !building.isConstructing) {
          this.completedBuildings.add(entity.id);
        }

        const unit = entity.getComponent<Unit>(Unit);
        if (unit) {
          this.knownUnits.add(entity.id);
        }
      }
      this.completionTrackingReady = true;
      return;
    }

    const now = this.time.now;

    for (const entity of entities) {
      const owner = entity.getComponent<Owner>(Owner);
      if (owner?.playerId !== this.localPlayerId) continue;

      const building = entity.getComponent<Building>(Building);
      if (building && !building.isConstructing && !this.completedBuildings.has(entity.id)) {
        if (now - this.lastBuildingCompleteTime > 900) {
          soundManager.play('building_complete');
          this.lastBuildingCompleteTime = now;
        }
        this.completedBuildings.add(entity.id);
      }

      const unit = entity.getComponent<Unit>(Unit);
      if (unit && !this.knownUnits.has(entity.id)) {
        if (now - this.lastUnitCompleteTime > 500) {
          soundManager.play('unit_complete');
          this.lastUnitCompleteTime = now;
        }
        this.knownUnits.add(entity.id);
      }
    }
  }
}
