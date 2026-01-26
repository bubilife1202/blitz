// ==========================================
// GameLoop - 틱 기반 게임 루프
// ==========================================

import type { GameState } from './GameState';
import type { CommandExecutor } from './commands/CommandExecutor';

export interface GameLoopCallbacks {
  onTick?: (tick: number) => void;
  onCommandsProcessed?: (tick: number) => void;
}

export class GameLoop {
  private gameState: GameState;
  private running: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private callbacks: GameLoopCallbacks;
  private commandExecutor: CommandExecutor | null = null;
  
  private readonly tickInterval: number;

  constructor(gameState: GameState, callbacks: GameLoopCallbacks = {}) {
    this.gameState = gameState;
    this.callbacks = callbacks;
    this.tickInterval = 1000 / gameState.config.tickRate;
  }

  setCommandExecutor(executor: CommandExecutor): void {
    this.commandExecutor = executor;
  }

  // 게임 루프 시작
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.loop();
  }

  // 게임 루프 정지
  stop(): void {
    this.running = false;
  }

  // 루프 실행 여부
  isRunning(): boolean {
    return this.running;
  }

  // 메인 루프 (requestAnimationFrame 기반)
  private loop = (): void => {
    if (!this.running) return;

    const currentTime = performance.now();
    let deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // 탭 전환 등으로 인한 긴 지연 시 최대 틱 수 제한 (버벅임 방지)
    // 최대 5틱(약 300ms)만 처리하고 나머지는 버림
    const maxDelta = this.tickInterval * 5;
    if (deltaTime > maxDelta) {
      deltaTime = maxDelta;
    }

    this.accumulator += deltaTime;

    // 고정 틱레이트로 업데이트
    while (this.accumulator >= this.tickInterval) {
      this.tick();
      this.accumulator -= this.tickInterval;
    }

    // 다음 프레임 예약
    requestAnimationFrame(this.loop);
  };

  // 단일 틱 처리
  private tick(): void {
    if (this.gameState.isGameOver()) {
      this.stop();
      return;
    }

    const currentTick = this.gameState.getCurrentTick();

    // 1. 이번 틱의 명령 처리
    this.processCommands(currentTick);
    this.callbacks.onCommandsProcessed?.(currentTick);

    // 2. 모든 시스템 업데이트
    this.updateSystems();

    // 3. 파괴된 엔티티 정리
    this.gameState.cleanupDestroyedEntities();

    // 4. 틱 증가
    this.gameState.incrementTick();

    // 5. 콜백 호출
    this.callbacks.onTick?.(currentTick);
  }

  private processCommands(tick: number): void {
    const commands = this.gameState.getCommandsForTick(tick);
    
    if (this.commandExecutor) {
      for (const command of commands) {
        this.commandExecutor.execute(command);
      }
    }

    this.gameState.clearCommandsForTick(tick);
  }

  // 시스템 업데이트
  private updateSystems(): void {
    const systems = this.gameState.getSystems();
    const allEntities = this.gameState.getAllEntities();
    const deltaTime = this.tickInterval / 1000; // 초 단위

    for (const system of systems) {
      if (!system.isEnabled()) continue;

      // 해당 시스템이 처리할 엔티티만 필터링
      const matchingEntities = allEntities.filter(entity => 
        !entity.isDestroyed() && system.matchesEntity(entity)
      );

      system.update(matchingEntities, this.gameState, deltaTime);
    }
  }

  // 수동 틱 실행 (디버그/테스트용)
  manualTick(): void {
    this.tick();
  }

  // 현재 상태 반환
  getGameState(): GameState {
    return this.gameState;
  }
}
