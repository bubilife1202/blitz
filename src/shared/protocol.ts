// ==========================================
// 클라이언트-서버 프로토콜 정의
// ==========================================

import type { GameCommand, GameSnapshot, PlayerId, Race } from './types';

// 클라이언트 → 서버 메시지
export enum ClientMessageType {
  JOIN_GAME = 'join_game',
  LEAVE_GAME = 'leave_game',
  GAME_COMMAND = 'game_command',
  REQUEST_SYNC = 'request_sync',
}

export interface ClientMessage {
  type: ClientMessageType;
  payload: JoinGamePayload | GameCommand | RequestSyncPayload | null;
}

export interface JoinGamePayload {
  playerName: string;
  race: Race;
}

export interface RequestSyncPayload {
  lastKnownTick: number;
}

// 서버 → 클라이언트 메시지
export enum ServerMessageType {
  GAME_JOINED = 'game_joined',
  GAME_STARTED = 'game_started',
  GAME_STATE = 'game_state',
  COMMAND_RECEIVED = 'command_received',
  GAME_OVER = 'game_over',
  ERROR = 'error',
}

export interface ServerMessage {
  type: ServerMessageType;
  payload: GameJoinedPayload | GameStatePayload | GameOverPayload | ErrorPayload | null;
}

export interface GameJoinedPayload {
  playerId: PlayerId;
  gameId: string;
}

export interface GameStatePayload {
  snapshot: GameSnapshot;
  commands: GameCommand[]; // 이번 틱에 실행된 명령들
}

export interface GameOverPayload {
  winnerId: PlayerId | null; // null = 무승부
  reason: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}
