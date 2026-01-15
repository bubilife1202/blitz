// ==========================================
// MenuScene - 메인 메뉴
// ==========================================

import Phaser from 'phaser';
import { AIDifficulty } from '@shared/types';

export class MenuScene extends Phaser.Scene {
  private difficultyPanel: Phaser.GameObjects.Container | null = null;
  private mainButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 배경
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // 타이틀
    const title = this.add.text(width / 2, height / 3, 'BLITZ', {
      fontSize: '64px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);

    // 서브타이틀
    const subtitle = this.add.text(width / 2, height / 3 + 60, 'Browser RTS', {
      fontSize: '24px',
      color: '#888888',
    });
    subtitle.setOrigin(0.5);

    // 싱글플레이 버튼
    this.mainButtons.push(this.createButton(
      width / 2,
      height / 2 + 50,
      'Single Player',
      () => this.showDifficultySelection()
    ));

    // 멀티플레이 버튼 (미구현)
    this.mainButtons.push(this.createButton(
      width / 2,
      height / 2 + 120,
      'Multiplayer (Coming Soon)',
      () => {
        // TODO: 멀티플레이어 로비
      },
      true // disabled
    ));

    // 버전 정보
    this.add.text(10, height - 30, 'v1.1.0', {
      fontSize: '14px',
      color: '#666666',
    });
  }

  private showDifficultySelection(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 메인 버튼 숨기기
    this.mainButtons.forEach(btn => btn.setVisible(false));

    // 난이도 선택 패널 생성
    this.difficultyPanel = this.add.container(width / 2, height / 2);

    // 난이도 선택 텍스트
    const selectText = this.add.text(0, -80, 'Select Difficulty', {
      fontSize: '28px',
      color: '#ffffff',
    });
    selectText.setOrigin(0.5);
    this.difficultyPanel.add(selectText);

    // Easy 버튼
    const easyBtn = this.createDifficultyButton(0, -20, 'Easy', 0x228822, AIDifficulty.EASY);
    this.difficultyPanel.add(easyBtn);

    // Normal 버튼
    const normalBtn = this.createDifficultyButton(0, 50, 'Normal', 0x225588, AIDifficulty.NORMAL);
    this.difficultyPanel.add(normalBtn);

    // Hard 버튼
    const hardBtn = this.createDifficultyButton(0, 120, 'Hard', 0x882222, AIDifficulty.HARD);
    this.difficultyPanel.add(hardBtn);

    // 뒤로가기 버튼
    const backBtn = this.createButton(0, 200, 'Back', () => this.hideDifficultySelection());
    this.difficultyPanel.add(backBtn);
  }

  private hideDifficultySelection(): void {
    // 난이도 패널 삭제
    if (this.difficultyPanel) {
      this.difficultyPanel.destroy();
      this.difficultyPanel = null;
    }

    // 메인 버튼 다시 표시
    this.mainButtons.forEach(btn => btn.setVisible(true));
  }

  private createDifficultyButton(
    x: number,
    y: number,
    text: string,
    color: number,
    difficulty: AIDifficulty
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 250, 45, color);
    bg.setStrokeStyle(2, color + 0x222222);
    bg.setInteractive({ useHandCursor: true });

    const btnText = this.add.text(0, 0, text, {
      fontSize: '20px',
      color: '#ffffff',
    });
    btnText.setOrigin(0.5);

    container.add([bg, btnText]);

    bg.on('pointerover', () => bg.setFillStyle(color + 0x111111));
    bg.on('pointerout', () => bg.setFillStyle(color));
    bg.on('pointerdown', () => bg.setFillStyle(color - 0x111111));
    bg.on('pointerup', () => {
      this.startSinglePlayer(difficulty);
    });

    return container;
  }

  private createButton(
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    disabled: boolean = false
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    // 버튼 배경
    const bg = this.add.rectangle(0, 0, 300, 50, disabled ? 0x333333 : 0x16213e);
    bg.setStrokeStyle(2, disabled ? 0x444444 : 0x0f3460);

    // 버튼 텍스트
    const btnText = this.add.text(0, 0, text, {
      fontSize: '20px',
      color: disabled ? '#666666' : '#ffffff',
    });
    btnText.setOrigin(0.5);

    container.add([bg, btnText]);

    if (!disabled) {
      bg.setInteractive({ useHandCursor: true });

      bg.on('pointerover', () => {
        bg.setFillStyle(0x1a1a4e);
      });

      bg.on('pointerout', () => {
        bg.setFillStyle(0x16213e);
      });

      bg.on('pointerdown', () => {
        bg.setFillStyle(0x0f3460);
      });

      bg.on('pointerup', () => {
        bg.setFillStyle(0x1a1a4e);
        onClick();
      });
    }

    return container;
  }

  private startSinglePlayer(difficulty: AIDifficulty = AIDifficulty.NORMAL): void {
    // 게임 씬으로 전환
    this.scene.start('GameScene', { mode: 'single', difficulty });
  }
}
