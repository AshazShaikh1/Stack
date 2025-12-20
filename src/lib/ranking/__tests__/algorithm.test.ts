// @ts-nocheck
/**
 * Unit tests for ranking algorithm
 * Feature flag: ranking/final-algo
 */

import { describe, it, expect } from "vitest";
import { computeRawScore, computeNormalizedScore, computeStats, DEFAULT_CONFIG } from '../algorithm';
import type { RankingSignals } from '../algorithm';

describe('Ranking Algorithm', () => {
  const testSignals: RankingSignals = {
    upvotes_count: 10,
    saves_count: 5,
    comments_count: 3,
    visits_count: 100,
    age_hours: 24,
    creator_quality: 50,
    promotion_boost: 0,
    abuse_factor: 1.0,
  };

  describe('computeRawScore', () => {
    it('should compute raw score for a card', () => {
      const score = computeRawScore('card', testSignals, DEFAULT_CONFIG);
      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
    });

    it('should compute raw score for a collection', () => {
      const score = computeRawScore('collection', testSignals, DEFAULT_CONFIG);
      expect(score).toBeGreaterThan(0);
      expect(typeof score).toBe('number');
    });

    it('should return different scores for cards vs collections with same signals', () => {
      const cardScore = computeRawScore('card', testSignals, DEFAULT_CONFIG);
      const collectionScore = computeRawScore('collection', testSignals, DEFAULT_CONFIG);
      expect(cardScore).not.toBe(collectionScore);
    });

    it('should handle zero signals', () => {
      const zeroSignals: RankingSignals = {
        ...testSignals,
        upvotes_count: 0,
        saves_count: 0,
        comments_count: 0,
        visits_count: 0,
      };
      const score = computeRawScore('card', zeroSignals, DEFAULT_CONFIG);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should apply age decay correctly', () => {
      const newItem: RankingSignals = { ...testSignals, age_hours: 1 };
      const oldItem: RankingSignals = { ...testSignals, age_hours: 1000 };
      
      const newScore = computeRawScore('card', newItem, DEFAULT_CONFIG);
      const oldScore = computeRawScore('card', oldItem, DEFAULT_CONFIG);
      
      expect(newScore).toBeGreaterThan(oldScore);
    });

    it('should apply creator quality factor', () => {
      const lowQuality: RankingSignals = { ...testSignals, creator_quality: 10 };
      const highQuality: RankingSignals = { ...testSignals, creator_quality: 90 };
      
      const lowScore = computeRawScore('card', lowQuality, DEFAULT_CONFIG);
      const highScore = computeRawScore('card', highQuality, DEFAULT_CONFIG);
      
      expect(highScore).toBeGreaterThan(lowScore);
    });

    it('should apply promotion boost', () => {
      const notPromoted: RankingSignals = { ...testSignals, promotion_boost: 0 };
      const promoted: RankingSignals = { ...testSignals, promotion_boost: 0.5 };
      
      const notPromotedScore = computeRawScore('card', notPromoted, DEFAULT_CONFIG);
      const promotedScore = computeRawScore('card', promoted, DEFAULT_CONFIG);
      
      expect(promotedScore).toBeGreaterThan(notPromotedScore);
    });

    it('should apply abuse factor', () => {
      const normal: RankingSignals = { ...testSignals, abuse_factor: 1.0 };
      const abused: RankingSignals = { ...testSignals, abuse_factor: 0.1 };
      
      const normalScore = computeRawScore('card', normal, DEFAULT_CONFIG);
      const abusedScore = computeRawScore('card', abused, DEFAULT_CONFIG);
      
      expect(normalScore).toBeGreaterThan(abusedScore);
    });
  });

  describe('computeNormalizedScore', () => {
    it('should compute z-score correctly', () => {
      const rawScore = 10;
      const mean = 5;
      const stddev = 2;
      
      const normScore = computeNormalizedScore(rawScore, mean, stddev);
      expect(normScore).toBe(2.5); // (10 - 5) / 2 = 2.5
    });

    it('should handle zero stddev by returning raw score', () => {
      const rawScore = 10;
      const mean = 10;
      const stddev = 0;
      
      const normScore = computeNormalizedScore(rawScore, mean, stddev);
      expect(normScore).toBe(rawScore);
    });

    it('should handle very small stddev', () => {
      const rawScore = 10;
      const mean = 5;
      const stddev = 0.00001; // Below epsilon
      
      const normScore = computeNormalizedScore(rawScore, mean, stddev);
      expect(normScore).toBe(rawScore); // Should return raw score
    });
  });

  describe('computeStats', () => {
    it('should compute mean and stddev correctly', () => {
      const scores = [1, 2, 3, 4, 5];
      const { mean, stddev } = computeStats(scores);
      
      expect(mean).toBe(3);
      expect(stddev).toBeCloseTo(Math.sqrt(2), 5);
    });

    it('should handle empty array', () => {
      const { mean, stddev } = computeStats([]);
      expect(mean).toBe(0);
      expect(stddev).toBe(0);
    });

    it('should handle single value', () => {
      const { mean, stddev } = computeStats([5]);
      expect(mean).toBe(5);
      expect(stddev).toBe(0);
    });
  });

  describe('Example numeric test', () => {
    it('should match expected ordering (Item A Card > Item B Collection)', () => {
      // Item A: Card with high engagement
      const itemA: RankingSignals = {
        upvotes_count: 50,
        saves_count: 30,
        comments_count: 10,
        visits_count: 500,
        age_hours: 24,
        creator_quality: 80,
        promotion_boost: 0,
        abuse_factor: 1.0,
      };

      // Item B: Collection with lower engagement
      const itemB: RankingSignals = {
        upvotes_count: 20,
        saves_count: 15,
        comments_count: 5,
        visits_count: 200,
        age_hours: 48,
        creator_quality: 60,
        promotion_boost: 0,
        abuse_factor: 1.0,
      };

      const scoreA = computeRawScore('card', itemA, DEFAULT_CONFIG);
      const scoreB = computeRawScore('collection', itemB, DEFAULT_CONFIG);

      expect(scoreA).toBeGreaterThan(scoreB);
    });
  });
});

