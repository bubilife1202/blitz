import { describe, it, expect, beforeEach } from 'vitest';
import { GameState } from '../src/core/GameState';
import { Race } from '../src/shared/types';

describe('GameState', () => {
  let gameState: GameState;

  beforeEach(() => {
    gameState = new GameState();
  });

  describe('Entity Management', () => {
    it('should create entities with unique IDs', () => {
      const e1 = gameState.createEntity();
      const e2 = gameState.createEntity();
      
      expect(e1.id).not.toBe(e2.id);
    });

    it('should retrieve entity by ID', () => {
      const entity = gameState.createEntity();
      const retrieved = gameState.getEntity(entity.id);
      
      expect(retrieved).toBe(entity);
    });

    it('should return undefined for non-existent entity', () => {
      const retrieved = gameState.getEntity(999);
      
      expect(retrieved).toBeUndefined();
    });

    it('should remove entity', () => {
      const entity = gameState.createEntity();
      const id = entity.id;
      
      gameState.removeEntity(id);
      
      expect(gameState.getEntity(id)).toBeUndefined();
    });

    it('should cleanup destroyed entities', () => {
      const e1 = gameState.createEntity();
      const e2 = gameState.createEntity();
      
      e1.destroy();
      gameState.cleanupDestroyedEntities();
      
      expect(gameState.getEntity(e1.id)).toBeUndefined();
      expect(gameState.getEntity(e2.id)).toBe(e2);
    });

    it('should cache getAllEntities result', () => {
      gameState.createEntity();
      gameState.createEntity();
      
      const first = gameState.getAllEntities();
      const second = gameState.getAllEntities();
      
      expect(first).toBe(second);
    });

    it('should invalidate cache on entity creation', () => {
      gameState.createEntity();
      const first = gameState.getAllEntities();
      
      gameState.createEntity();
      const second = gameState.getAllEntities();
      
      expect(first).not.toBe(second);
      expect(second.length).toBe(2);
    });
  });

  describe('Player Management', () => {
    it('should add player with initial resources', () => {
      const player = gameState.addPlayer(1, Race.TERRAN);
      
      expect(player.id).toBe(1);
      expect(player.race).toBe(Race.TERRAN);
      expect(player.resources.minerals).toBe(50);
      expect(player.resources.gas).toBe(0);
    });

    it('should modify player resources', () => {
      gameState.addPlayer(1, Race.TERRAN);
      
      gameState.modifyPlayerResources(1, { minerals: 100, gas: 50 });
      
      const resources = gameState.getPlayerResources(1);
      expect(resources?.minerals).toBe(150);
      expect(resources?.gas).toBe(50);
    });
  });

  describe('Tick Management', () => {
    it('should start at tick 0', () => {
      expect(gameState.getCurrentTick()).toBe(0);
    });

    it('should increment tick', () => {
      gameState.incrementTick();
      gameState.incrementTick();
      
      expect(gameState.getCurrentTick()).toBe(2);
    });
  });

  describe('Game Over', () => {
    it('should track game over state', () => {
      expect(gameState.isGameOver()).toBe(false);
      
      gameState.endGame(1);
      
      expect(gameState.isGameOver()).toBe(true);
      expect(gameState.getWinnerId()).toBe(1);
    });
  });
});
