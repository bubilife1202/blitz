// ==========================================
// NetworkClient - P2P 네트워크 관리 (WebRTC via PeerJS)
// ==========================================

import Peer, { DataConnection } from 'peerjs';

// 네트워크 이벤트 타입
export enum NetworkEvent {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  DATA_RECEIVED = 'data_received',
  PLAYER_JOINED = 'player_joined',
  GAME_START = 'game_start',
  COMMAND = 'command', // 게임 명령 동기화
  ERROR = 'error',
}

// 전송되는 메시지 구조
export interface NetworkMessage {
  type: string;
  payload: any;
  timestamp: number;
}

type EventListener = (payload?: any) => void;

export class NetworkClient {
  private static instance: NetworkClient;
  
  private peer: Peer | null = null;
  private connections: DataConnection[] = [];
  private listeners: Map<NetworkEvent, EventListener[]> = new Map();
  private initPromise: Promise<string> | null = null;
  private initReject: ((reason?: unknown) => void) | null = null;
  
  public myId: string = '';
  public isHost: boolean = false;
  
  private constructor() {}
  
  public static getInstance(): NetworkClient {
    if (!NetworkClient.instance) {
      NetworkClient.instance = new NetworkClient();
    }
    return NetworkClient.instance;
  }
  
  // Peer 초기화 (자신의 ID 생성)
  public initialize(): Promise<string> {
    if (this.myId) {
      return Promise.resolve(this.myId);
    }

    if (this.peer?.id) {
      this.myId = this.peer.id;
      return Promise.resolve(this.myId);
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      this.initReject = reject;

      if (!this.peer) {
        // PeerJS Cloud 서버 사용 (무료/공용)
        this.peer = new Peer();

        this.peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (err) => {
          console.error('NetworkClient Error:', err);
          this.emit(NetworkEvent.ERROR, err);
          if (this.initReject) {
            this.initReject(err);
            this.initReject = null;
            this.initPromise = null;
          }
        });
      }

      this.peer.once('open', (id) => {
        this.myId = id;
        console.log(`NetworkClient: Initialized with ID: ${id}`);
        this.initPromise = null;
        this.initReject = null;
        resolve(id);
      });
    });

    return this.initPromise;
  }
  
  // 방 만들기 (Host)
  public createRoom(): void {
    this.isHost = true;
    console.log('NetworkClient: Room created. Waiting for players...');
  }
  
  // 방 참가하기 (Guest)
  public joinRoom(hostId: string): void {
    this.isHost = false;
    if (!this.peer) return;
    
    console.log(`NetworkClient: Connecting to host ${hostId}...`);
    const conn = this.peer.connect(hostId);
    this.handleIncomingConnection(conn);
  }
  
  // 연결 처리
  private handleIncomingConnection(conn: DataConnection): void {
    conn.on('open', () => {
      console.log(`NetworkClient: Connected to peer ${conn.peer}`);
      this.connections.push(conn);
      this.emit(NetworkEvent.PLAYER_JOINED, conn.peer);
      
      // 호스트인 경우, 연결된 피어에게 환영 메시지 전송
      if (this.isHost) {
        this.sendToPeer(conn, { type: 'WELCOME', payload: { hostId: this.myId } });
      }
    });
    
    conn.on('data', (data) => {
      this.handleData(data as NetworkMessage);
    });
    
    conn.on('close', () => {
      console.log(`NetworkClient: Connection closed with peer ${conn.peer}`);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
      this.emit(NetworkEvent.DISCONNECTED, conn.peer);
    });
    
    conn.on('error', (err) => {
      console.error('Connection Error:', err);
    });
  }
  
  // 데이터 수신 처리
  private handleData(message: NetworkMessage): void {
    // console.log('Received:', message); // 디버깅용
    this.emit(NetworkEvent.DATA_RECEIVED, message);
    
    // 특정 메시지 타입에 대한 처리
    if (message.type === 'START_GAME') {
      this.emit(NetworkEvent.GAME_START, message.payload);
    } else if (message.type === 'COMMAND') {
      this.emit(NetworkEvent.COMMAND, message.payload);
    }
  }
  
  // 게임 명령 전송
  public sendCommand(command: any): void {
    this.broadcast('COMMAND', command);
  }
  
  // 메시지 전송 (브로드캐스트)
  public broadcast(type: string, payload: any): void {
    const message: NetworkMessage = {
      type,
      payload,
      timestamp: Date.now(),
    };
    
    this.connections.forEach(conn => {
      if (conn.open) conn.send(message);
    });
  }
  
  // 특정 피어에게 전송
  private sendToPeer(conn: DataConnection, message: any): void {
    if (conn.open) conn.send(message);
  }
  
  // 이벤트 리스너 등록
  public on(event: NetworkEvent, callback: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  // 이벤트 리스너 해제
  public off(event: NetworkEvent, callback: EventListener): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    this.listeners.set(event, callbacks.filter((cb) => cb !== callback));
  }

  // 모든 이벤트 리스너 제거
  public removeAllListeners(): void {
    this.listeners.clear();
  }
  
  // 이벤트 발생
  private emit(event: NetworkEvent, payload?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(payload));
    }
  }
  
  // 연결 종료
  public disconnect(): void {
    this.connections.forEach(conn => conn.close());
    this.connections = [];
    this.listeners.clear(); // 모든 이벤트 리스너 정리
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.isHost = false;
    this.myId = '';
    this.initPromise = null;
    this.initReject = null;
  }

  // Singleton 인스턴스 완전 초기화 (씬 전환/재시작 시 호출)
  public static resetInstance(): void {
    if (NetworkClient.instance) {
      NetworkClient.instance.disconnect();
      NetworkClient.instance = null!;
    }
  }
}
