// ==========================================
// 게임 진입점
// ==========================================

import Phaser from 'phaser';
import { BootScene, MenuScene, GameScene, LobbyScene } from './scenes';

// Phaser 게임 설정
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 1280,
  height: 720,
  backgroundColor: '#000000',
  scene: [BootScene, MenuScene, LobbyScene, GameScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    mouse: {
      preventDefaultWheel: false,
    },
  },
  render: {
    pixelArt: true, // 픽셀 아트 스타일 렌더링
    antialias: false,
  },
};

// 게임 인스턴스 생성
const game = new Phaser.Game(config);

// 개발용 전역 변수
declare global {
  interface Window {
    game: Phaser.Game;
  }
}
window.game = game;

console.log('StarCraft Web initialized!');
