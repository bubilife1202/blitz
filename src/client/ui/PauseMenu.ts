// ==========================================
// PauseMenu - 일시정지 메뉴 UI
// ==========================================

import Phaser from 'phaser';

export class PauseMenu {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;
  private isVisible: boolean = false;

  // 콜백
  public onResume?: () => void;
  public onRestart?: () => void;
  public onMainMenu?: () => void;
  public onSettings?: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.createUI();
  }

  private createUI(): void {
    const width = this.scene.scale.width;
    const height = this.scene.scale.height;

    // 반투명 오버레이
    this.overlay = this.scene.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.7
    );
    this.overlay.setScrollFactor(0);
    this.overlay.setDepth(6000); // Above gameOverText (5000)

    // 컨테이너
    this.container = this.scene.add.container(width / 2, height / 2);
    this.container.setScrollFactor(0);
    this.container.setDepth(6001); // Above overlay

    // 메뉴 박스 배경
    const menuBg = this.scene.add.rectangle(0, 0, 300, 350, 0x1a1a2e);
    menuBg.setStrokeStyle(3, 0x0f3460);
    this.container.add(menuBg);

    // 타이틀
    const title = this.scene.add.text(0, -130, 'PAUSED', {
      fontSize: '32px',
      color: '#ffffff',
      fontStyle: 'bold',
    });
    title.setOrigin(0.5);
    this.container.add(title);

    // 버튼들
    const buttonY = -50;
    const buttonSpacing = 60;

    this.createButton(0, buttonY, 'Resume Game', () => this.onResume?.());
    this.createButton(0, buttonY + buttonSpacing, 'Restart', () => this.onRestart?.());
    this.createButton(0, buttonY + buttonSpacing * 2, 'Settings', () => this.onSettings?.());
    this.createButton(0, buttonY + buttonSpacing * 3, 'Main Menu', () => this.onMainMenu?.());

    // ESC 힌트
    const hint = this.scene.add.text(0, 140, 'Press ESC to resume', {
      fontSize: '14px',
      color: '#888888',
    });
    hint.setOrigin(0.5);
    this.container.add(hint);

    // 초기에는 숨김
    this.hide();
  }

  private createButton(x: number, y: number, text: string, onClick: () => void): void {
    const bg = this.scene.add.rectangle(x, y, 200, 45, 0x16213e);
    bg.setStrokeStyle(2, 0x0f3460);
    bg.setInteractive({ useHandCursor: true });

    const btnText = this.scene.add.text(x, y, text, {
      fontSize: '18px',
      color: '#ffffff',
    });
    btnText.setOrigin(0.5);

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

    this.container.add([bg, btnText]);
  }

  show(): void {
    this.isVisible = true;
    this.overlay.setVisible(true);
    this.container.setVisible(true);
  }

  hide(): void {
    this.isVisible = false;
    this.overlay.setVisible(false);
    this.container.setVisible(false);
  }

  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  getIsVisible(): boolean {
    return this.isVisible;
  }

  destroy(): void {
    this.overlay.destroy();
    this.container.destroy();
  }
}
