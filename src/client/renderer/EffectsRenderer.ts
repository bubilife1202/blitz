// ==========================================
// EffectsRenderer - 강화된 시각 효과
// ==========================================

import Phaser from 'phaser';

interface Projectile {
  id: number;
  graphics: Phaser.GameObjects.Graphics;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  progress: number;
  speed: number;
  color: number;
  size: number;
  type: 'bullet' | 'missile' | 'flame' | 'heal';
}

interface MuzzleFlash {
  id: number;
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  progress: number;
  angle: number;
  size: number;
}

interface HitSpark {
  id: number;
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  progress: number;
  particles: Array<{ angle: number; speed: number; size: number; color: number }>;
}

interface Explosion {
  id: number;
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  progress: number;
  maxRadius: number;
  color: number;
  type: 'small' | 'medium' | 'large' | 'heal';
  shakeIntensity: number;
}

interface DeathEffect {
  id: number;
  graphics: Phaser.GameObjects.Graphics;
  x: number;
  y: number;
  progress: number;
  size: number;
  isBuilding: boolean;
}

export class EffectsRenderer {
  private scene: Phaser.Scene;
  private projectiles: Map<number, Projectile> = new Map();
  private muzzleFlashes: Map<number, MuzzleFlash> = new Map();
  private hitSparks: Map<number, HitSpark> = new Map();
  private explosions: Map<number, Explosion> = new Map();
  private deathEffects: Map<number, DeathEffect> = new Map();
  private nextId: number = 0;
  
  // 화면 흔들림
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  // 프로젝타일 생성 (머즐 플래시 포함)
  createProjectile(
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    type: 'bullet' | 'missile' | 'flame' | 'heal' = 'bullet'
  ): number {
    const id = this.nextId++;
    const graphics = this.scene.add.graphics();
    graphics.setDepth(50);

    const config = {
      bullet: { color: 0xffff00, size: 4, speed: 0.18 },
      missile: { color: 0xff6600, size: 6, speed: 0.10 },
      flame: { color: 0xff3300, size: 10, speed: 0.14 },
      heal: { color: 0x00ff88, size: 5, speed: 0.12 },
    };

    const c = config[type];

    this.projectiles.set(id, {
      id,
      graphics,
      startX,
      startY,
      targetX,
      targetY,
      progress: 0,
      speed: c.speed,
      color: c.color,
      size: c.size,
      type,
    });

    // 머즐 플래시 생성 (힐 제외)
    if (type !== 'heal') {
      this.createMuzzleFlash(startX, startY, targetX, targetY, type);
    }

    return id;
  }

  // 머즐 플래시 생성
  private createMuzzleFlash(startX: number, startY: number, targetX: number, targetY: number, type: string): void {
    const id = this.nextId++;
    const graphics = this.scene.add.graphics();
    graphics.setDepth(55);

    const angle = Math.atan2(targetY - startY, targetX - startX);
    const size = type === 'flame' ? 20 : type === 'missile' ? 15 : 10;

    this.muzzleFlashes.set(id, {
      id,
      graphics,
      x: startX,
      y: startY,
      progress: 0,
      angle,
      size,
    });
  }

  // 히트 스파크 생성
  createHitSpark(x: number, y: number, intensity: number = 1): void {
    const id = this.nextId++;
    const graphics = this.scene.add.graphics();
    graphics.setDepth(60);

    const numParticles = Math.floor(5 + intensity * 5);
    const particles = [];
    for (let i = 0; i < numParticles; i++) {
      particles.push({
        angle: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 4 * intensity,
        size: 1 + Math.random() * 2,
        color: Math.random() > 0.5 ? 0xffff00 : 0xff8800,
      });
    }

    this.hitSparks.set(id, {
      id,
      graphics,
      x,
      y,
      progress: 0,
      particles,
    });
  }

  // 폭발 생성
  createExplosion(
    x: number,
    y: number,
    type: 'small' | 'medium' | 'large' | 'heal' = 'small'
  ): number {
    const id = this.nextId++;
    const graphics = this.scene.add.graphics();
    graphics.setDepth(55);

    const config = {
      small: { maxRadius: 18, color: 0xff6600, shake: 2 },
      medium: { maxRadius: 30, color: 0xff4400, shake: 4 },
      large: { maxRadius: 50, color: 0xff2200, shake: 8 },
      heal: { maxRadius: 25, color: 0x00ff88, shake: 0 },
    };

    const c = config[type];

    this.explosions.set(id, {
      id,
      graphics,
      x,
      y,
      progress: 0,
      maxRadius: c.maxRadius,
      color: c.color,
      type,
      shakeIntensity: c.shake,
    });

    // 화면 흔들림
    if (c.shake > 0) {
      this.triggerShake(c.shake, 150);
    }

    // 히트 스파크 추가
    if (type !== 'heal') {
      this.createHitSpark(x, y, type === 'large' ? 2 : type === 'medium' ? 1.5 : 1);
    }

    return id;
  }

  // 화면 흔들림 트리거
  triggerShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
  }

  // 죽음 효과 생성
  createDeathEffect(x: number, y: number, size: number, isBuilding: boolean = false): number {
    const id = this.nextId++;
    const graphics = this.scene.add.graphics();
    graphics.setDepth(60);

    this.deathEffects.set(id, {
      id,
      graphics,
      x,
      y,
      progress: 0,
      size,
      isBuilding,
    });

    // 큰 폭발 + 화면 흔들림
    if (isBuilding) {
      this.triggerShake(15, 400);
      // 다중 폭발
      for (let i = 0; i < 3; i++) {
        setTimeout(() => {
          const offsetX = (Math.random() - 0.5) * size;
          const offsetY = (Math.random() - 0.5) * size;
          this.createExplosion(x + offsetX, y + offsetY, 'large');
        }, i * 100);
      }
    } else {
      this.triggerShake(5, 100);
    }

    return id;
  }

  update(): void {
    const deltaMs = this.scene.game.loop.delta;
    
    // 화면 흔들림 적용
    this.updateShake(deltaMs);

    // 머즐 플래시 업데이트
    this.updateMuzzleFlashes();

    // 프로젝타일 업데이트
    this.updateProjectiles();

    // 히트 스파크 업데이트
    this.updateHitSparks();

    // 폭발 업데이트
    this.updateExplosions();

    // 죽음 효과 업데이트
    this.updateDeathEffects();
  }

  private updateShake(deltaMs: number): void {
    if (this.shakeDuration > 0) {
      this.shakeDuration -= deltaMs;
      
      const offsetX = (Math.random() - 0.5) * this.shakeIntensity * 2;
      const offsetY = (Math.random() - 0.5) * this.shakeIntensity * 2;
      
      this.scene.cameras.main.setScroll(
        this.scene.cameras.main.scrollX + offsetX,
        this.scene.cameras.main.scrollY + offsetY
      );
      
      // 감쇠
      this.shakeIntensity *= 0.95;
      
      if (this.shakeDuration <= 0) {
        this.shakeIntensity = 0;
      }
    }
  }

  private updateMuzzleFlashes(): void {
    for (const [id, flash] of this.muzzleFlashes) {
      flash.progress += 0.25;

      if (flash.progress >= 1) {
        flash.graphics.destroy();
        this.muzzleFlashes.delete(id);
        continue;
      }

      flash.graphics.clear();
      flash.graphics.setPosition(flash.x, flash.y);

      const alpha = 1 - flash.progress;
      const scale = 1 + flash.progress * 0.5;
      const size = flash.size * scale;

      // 밝은 코어
      flash.graphics.fillStyle(0xffffff, alpha);
      flash.graphics.fillCircle(0, 0, size * 0.3);

      // 주황색 플레어
      flash.graphics.fillStyle(0xff8800, alpha * 0.8);
      flash.graphics.fillCircle(0, 0, size * 0.5);

      // 방사형 라인
      const numRays = 6;
      for (let i = 0; i < numRays; i++) {
        const rayAngle = flash.angle + (Math.PI * 2 * i / numRays) + flash.progress;
        const rayLength = size * (0.8 + Math.random() * 0.4);
        flash.graphics.lineStyle(2 * alpha, 0xffff00, alpha);
        flash.graphics.lineBetween(0, 0, Math.cos(rayAngle) * rayLength, Math.sin(rayAngle) * rayLength);
      }
    }
  }

  private updateProjectiles(): void {
    for (const [id, proj] of this.projectiles) {
      proj.progress += proj.speed;

      if (proj.progress >= 1) {
        proj.graphics.destroy();
        this.projectiles.delete(id);
        // 타격 시 폭발
        this.createExplosion(proj.targetX, proj.targetY, proj.type === 'heal' ? 'heal' : 'small');
        continue;
      }

      const x = proj.startX + (proj.targetX - proj.startX) * proj.progress;
      const y = proj.startY + (proj.targetY - proj.startY) * proj.progress;

      proj.graphics.clear();
      proj.graphics.setPosition(x, y);

      const angle = Math.atan2(proj.targetY - proj.startY, proj.targetX - proj.startX);

      switch (proj.type) {
        case 'bullet':
          // 밝은 탄환 코어
          proj.graphics.fillStyle(0xffffff, 1);
          proj.graphics.fillCircle(0, 0, proj.size * 0.6);
          proj.graphics.fillStyle(proj.color, 1);
          proj.graphics.fillCircle(0, 0, proj.size);
          // 트레일
          for (let i = 1; i <= 5; i++) {
            const trailAlpha = 1 - i * 0.18;
            const trailSize = proj.size * (1 - i * 0.15);
            proj.graphics.fillStyle(proj.color, trailAlpha);
            proj.graphics.fillCircle(
              -Math.cos(angle) * i * 5,
              -Math.sin(angle) * i * 5,
              trailSize
            );
          }
          break;

        case 'missile':
          // 미사일 본체
          proj.graphics.fillStyle(0x888888, 1);
          proj.graphics.save();
          proj.graphics.translateCanvas(0, 0);
          proj.graphics.rotateCanvas(angle);
          proj.graphics.fillRect(-6, -3, 12, 6);
          proj.graphics.restore();
          
          // 불꽃 추진
          proj.graphics.fillStyle(0xff4400, 0.9);
          proj.graphics.fillCircle(-Math.cos(angle) * 8, -Math.sin(angle) * 8, 5);
          proj.graphics.fillStyle(0xffff00, 0.7);
          proj.graphics.fillCircle(-Math.cos(angle) * 10, -Math.sin(angle) * 10, 3);
          
          // 연기 트레일
          for (let i = 1; i <= 4; i++) {
            const smokeX = -Math.cos(angle) * (10 + i * 8);
            const smokeY = -Math.sin(angle) * (10 + i * 8);
            proj.graphics.fillStyle(0x666666, 0.5 - i * 0.1);
            proj.graphics.fillCircle(smokeX + (Math.random() - 0.5) * 4, smokeY + (Math.random() - 0.5) * 4, 4 - i * 0.5);
          }
          break;

        case 'flame':
          // 화염 효과 (여러 원)
          for (let i = 0; i < 8; i++) {
            const flameX = (Math.random() - 0.5) * proj.size * 1.5;
            const flameY = (Math.random() - 0.5) * proj.size * 1.5;
            const flameSize = proj.size * (0.3 + Math.random() * 0.5);
            const alpha = 0.6 + Math.random() * 0.4;
            const colors = [0xff0000, 0xff3300, 0xff6600, 0xffaa00, 0xffff00];
            proj.graphics.fillStyle(colors[Math.floor(Math.random() * colors.length)], alpha);
            proj.graphics.fillCircle(flameX, flameY, flameSize);
          }
          // 밝은 코어
          proj.graphics.fillStyle(0xffffff, 0.8);
          proj.graphics.fillCircle(0, 0, proj.size * 0.3);
          break;

        case 'heal':
          // 치유 파티클
          proj.graphics.fillStyle(proj.color, 0.9);
          proj.graphics.fillCircle(0, 0, proj.size);
          // 반짝임
          proj.graphics.fillStyle(0xffffff, 0.8 + Math.sin(proj.progress * 20) * 0.2);
          proj.graphics.fillCircle(0, 0, proj.size * 0.4);
          // + 기호
          proj.graphics.fillStyle(0xffffff, 0.9);
          proj.graphics.fillRect(-1, -proj.size * 0.7, 2, proj.size * 1.4);
          proj.graphics.fillRect(-proj.size * 0.7, -1, proj.size * 1.4, 2);
          break;
      }
    }
  }

  private updateHitSparks(): void {
    for (const [id, spark] of this.hitSparks) {
      spark.progress += 0.12;

      if (spark.progress >= 1) {
        spark.graphics.destroy();
        this.hitSparks.delete(id);
        continue;
      }

      spark.graphics.clear();
      spark.graphics.setPosition(spark.x, spark.y);

      const alpha = 1 - spark.progress;

      for (const p of spark.particles) {
        const dist = p.speed * spark.progress * 15;
        const px = Math.cos(p.angle) * dist;
        const py = Math.sin(p.angle) * dist;
        const size = p.size * (1 - spark.progress * 0.5);
        
        spark.graphics.fillStyle(p.color, alpha);
        spark.graphics.fillCircle(px, py, size);
      }
    }
  }

  private updateExplosions(): void {
    for (const [id, exp] of this.explosions) {
      exp.progress += 0.1;

      if (exp.progress >= 1) {
        exp.graphics.destroy();
        this.explosions.delete(id);
        continue;
      }

      exp.graphics.clear();
      exp.graphics.setPosition(exp.x, exp.y);

      const radius = exp.maxRadius * exp.progress;
      const alpha = 1 - exp.progress;

      if (exp.type === 'heal') {
        // 치유 폭발 (녹색 파동)
        exp.graphics.lineStyle(4, exp.color, alpha);
        exp.graphics.strokeCircle(0, 0, radius);
        exp.graphics.fillStyle(exp.color, alpha * 0.3);
        exp.graphics.fillCircle(0, 0, radius * 0.6);
        // 반짝이는 파티클
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI * 2 * i / 6) + exp.progress * 2;
          const px = Math.cos(angle) * radius * 0.8;
          const py = Math.sin(angle) * radius * 0.8;
          exp.graphics.fillStyle(0xffffff, alpha * 0.8);
          exp.graphics.fillCircle(px, py, 3);
        }
      } else {
        // 일반 폭발 - 더 화려하게
        
        // 외곽 충격파
        exp.graphics.lineStyle(3, 0xffff00, alpha * 0.6);
        exp.graphics.strokeCircle(0, 0, radius * 1.2);
        
        // 외곽 링
        exp.graphics.lineStyle(2, 0xff8800, alpha * 0.8);
        exp.graphics.strokeCircle(0, 0, radius);

        // 내부 불꽃
        const innerRadius = radius * (1 - exp.progress * 0.4);
        const gradient = [
          { r: innerRadius, color: 0xff2200, alpha: alpha * 0.9 },
          { r: innerRadius * 0.7, color: 0xff6600, alpha: alpha * 0.95 },
          { r: innerRadius * 0.4, color: 0xffaa00, alpha: alpha },
        ];
        
        for (const g of gradient) {
          exp.graphics.fillStyle(g.color, g.alpha);
          exp.graphics.fillCircle(0, 0, g.r);
        }

        // 밝은 코어
        if (exp.progress < 0.4) {
          const coreAlpha = (0.4 - exp.progress) * 2.5;
          exp.graphics.fillStyle(0xffffff, coreAlpha);
          exp.graphics.fillCircle(0, 0, innerRadius * 0.3);
        }

        // 파편 (더 많이, 더 역동적으로)
        if (exp.type !== 'small') {
          const numDebris = exp.type === 'large' ? 12 : 8;
          for (let i = 0; i < numDebris; i++) {
            const debrisAngle = (Math.PI * 2 * i) / numDebris + exp.progress * 3;
            const debrisDist = radius * (1 + exp.progress * 0.5);
            const dx = Math.cos(debrisAngle) * debrisDist;
            const dy = Math.sin(debrisAngle) * debrisDist;
            const debrisSize = 3 - exp.progress * 2;
            
            exp.graphics.fillStyle(0xff8800, alpha);
            exp.graphics.fillCircle(dx, dy, debrisSize);
            
            // 작은 트레일
            exp.graphics.fillStyle(0xff4400, alpha * 0.5);
            exp.graphics.fillCircle(dx * 0.9, dy * 0.9, debrisSize * 0.7);
          }
        }

        // 연기
        if (exp.progress > 0.3) {
          const smokeAlpha = (exp.progress - 0.3) * 0.5 * alpha;
          exp.graphics.fillStyle(0x444444, smokeAlpha);
          for (let i = 0; i < 4; i++) {
            const smokeX = (Math.random() - 0.5) * radius;
            const smokeY = -exp.progress * 20 + (Math.random() - 0.5) * radius * 0.5;
            const smokeSize = 5 + Math.random() * 10;
            exp.graphics.fillCircle(smokeX, smokeY, smokeSize);
          }
        }
      }
    }
  }

  private updateDeathEffects(): void {
    for (const [id, death] of this.deathEffects) {
      death.progress += 0.035;

      if (death.progress >= 1) {
        death.graphics.destroy();
        this.deathEffects.delete(id);
        continue;
      }

      death.graphics.clear();
      death.graphics.setPosition(death.x, death.y);

      const alpha = 1 - death.progress;

      if (death.isBuilding) {
        // 건물 파괴 효과 (연속 폭발 + 무너지는 잔해)
        
        // 다중 폭발
        const numExplosions = 6;
        for (let i = 0; i < numExplosions; i++) {
          const expDelay = i * 0.12;
          const expProgress = Math.max(0, (death.progress - expDelay) * 1.5);
          if (expProgress > 0 && expProgress < 1) {
            const expX = (Math.random() - 0.5) * death.size * 0.8;
            const expY = (Math.random() - 0.5) * death.size * 0.8;
            const expRadius = 15 + Math.random() * 20;
            
            // 불꽃
            death.graphics.fillStyle(0xff6600, (1 - expProgress) * 0.8);
            death.graphics.fillCircle(expX, expY, expRadius * expProgress);
            death.graphics.fillStyle(0xffaa00, (1 - expProgress) * 0.6);
            death.graphics.fillCircle(expX, expY, expRadius * expProgress * 0.6);
          }
        }

        // 잔해 파편 (떨어지는 효과)
        if (death.progress > 0.2) {
          const debrisProgress = (death.progress - 0.2) / 0.8;
          for (let i = 0; i < 12; i++) {
            const debrisAngle = (Math.PI * 2 * i) / 12;
            const debrisDist = death.size * 0.5 * debrisProgress;
            const fallOffset = debrisProgress * debrisProgress * 30; // 중력 효과
            const dx = Math.cos(debrisAngle) * debrisDist;
            const dy = Math.sin(debrisAngle) * debrisDist + fallOffset;
            
            death.graphics.fillStyle(0x555555, alpha);
            death.graphics.fillRect(dx - 4, dy - 4, 8, 8);
          }
        }

        // 연기 기둥
        death.graphics.fillStyle(0x222222, alpha * 0.6);
        const smokeHeight = death.progress * 60;
        const smokeWidth = death.size * 0.4 * (1 + death.progress * 0.5);
        death.graphics.fillEllipse(0, -smokeHeight / 2, smokeWidth, smokeHeight);
        
      } else {
        // 유닛 죽음 효과
        
        // 초기 섬광
        if (death.progress < 0.2) {
          const flashAlpha = (0.2 - death.progress) * 5;
          death.graphics.fillStyle(0xffffff, flashAlpha);
          death.graphics.fillCircle(0, 0, death.size * 2);
        }

        // 빨간 플래시
        if (death.progress < 0.4) {
          const redAlpha = (0.4 - death.progress) * 2.5;
          death.graphics.fillStyle(0xff0000, redAlpha * 0.7);
          death.graphics.fillCircle(0, 0, death.size * 1.5);
        }

        // 파편 (사방으로 퍼짐)
        const numParticles = 8;
        for (let i = 0; i < numParticles; i++) {
          const angle = (Math.PI * 2 * i) / numParticles + death.progress * 2;
          const dist = death.size * death.progress * 3;
          const fallOffset = death.progress * death.progress * 15;
          const px = Math.cos(angle) * dist;
          const py = Math.sin(angle) * dist + fallOffset;
          const particleSize = 3 * (1 - death.progress);
          
          death.graphics.fillStyle(0xff6600, alpha);
          death.graphics.fillCircle(px, py, particleSize);
        }

        // 피 스플래터 (바닥에 남는 흔적)
        if (death.progress > 0.3) {
          const splatterAlpha = alpha * 0.4;
          death.graphics.fillStyle(0x880000, splatterAlpha);
          for (let i = 0; i < 5; i++) {
            const sx = (Math.random() - 0.5) * death.size * 2;
            const sy = (Math.random() - 0.5) * death.size + death.size * 0.3;
            death.graphics.fillCircle(sx, sy, 2 + Math.random() * 3);
          }
        }
      }
    }
  }

  destroy(): void {
    for (const proj of this.projectiles.values()) {
      proj.graphics.destroy();
    }
    this.projectiles.clear();

    for (const flash of this.muzzleFlashes.values()) {
      flash.graphics.destroy();
    }
    this.muzzleFlashes.clear();

    for (const spark of this.hitSparks.values()) {
      spark.graphics.destroy();
    }
    this.hitSparks.clear();

    for (const exp of this.explosions.values()) {
      exp.graphics.destroy();
    }
    this.explosions.clear();

    for (const death of this.deathEffects.values()) {
      death.graphics.destroy();
    }
    this.deathEffects.clear();
  }
}
