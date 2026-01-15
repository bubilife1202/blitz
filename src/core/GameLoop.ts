// ==========================================
// GameLoop - 틱 기반 게임 루프
// ==========================================
// 고정 틱레이트로 게임 로직 업데이트
// 렌더링과 분리된 순수 로직 루프

import type { GameState } from './GameState';

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
  
  // 틱 간격 (밀리초)
  private readonly tickInterval: number;

  constructor(gameState: GameState, callbacks: GameLoopCallbacks = {}) {
    this.gameState = gameState;
    this.callbacks = callbacks;
    // tickRate가 16이면 1000/16 = 62.5ms 간격
    this.tickInterval = 1000 / gameState.config.tickRate;
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
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

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

  // 명령 처리
  private processCommands(tick: number): void {
    const commands = this.gameState.getCommandsForTick(tick);
    
    for (const _command of commands) {
      // TODO: 명령 핸들러로 위임
      // CommandHandler.execute(_command, this.gameState);
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
