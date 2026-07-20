/**
 * Unit tests for rowColorResolver — row-level + name-cell stage detection
 */

import { describe, test, expect } from '@jest/globals';
import {
  extractNameCellColor,
  extractRowColors,
  detectBestStageFromColors,
  resolveStageFromRow,
} from '../../services/rowColorResolver.js';

describe('rowColorResolver', () => {
  describe('extractNameCellColor', () => {
    test('reads color from Candidate Name column', () => {
      const color = extractNameCellColor({ 'Candidate Name': '#92D050' });
      expect(color).toBe('#92D050');
    });

    test('returns null when no name column colored', () => {
      expect(extractNameCellColor({ Position: '#FF0000' })).toBeNull();
    });
  });

  describe('extractRowColors', () => {
    test('collects unique colors across all columns', () => {
      const colors = extractRowColors({
        Date: '#FFFFFF',
        Name: '#9BC2E6',
        Position: '#9BC2E6',
        Status: '#9BC2E6',
      });
      expect(colors).toEqual(['#9BC2E6']);
    });
  });

  describe('detectBestStageFromColors', () => {
    test('maps Book1 light blue to Hired', () => {
      const match = detectBestStageFromColors(['#9BC2E6']);
      expect(match).not.toBeNull();
      expect(match.mainStage).toBe('hired');
      expect(match.legacyStage).toBe('Hired');
    });

    test('maps official selected green', () => {
      const match = detectBestStageFromColors(['#92D050']);
      expect(match.mainStage).toBe('selected');
    });
  });

  describe('resolveStageFromRow', () => {
    test('uses row color when name cell is uncolored (Book1 format)', () => {
      const result = resolveStageFromRow({
        stageText: '',
        cellColors: {
          Name: undefined,
          Position: '#9BC2E6',
          Status: '#9BC2E6',
          Remarks: '#9BC2E6',
        },
        rowColors: ['#9BC2E6'],
      });
      expect(result.mainStage).toBe('hired');
      expect(result.colorSource).toBe('row');
    });

    test('prefers name cell color for official template', () => {
      const result = resolveStageFromRow({
        stageText: '',
        cellColors: { 'Candidate Name': '#FF0000' },
      });
      expect(result.mainStage).toBe('rejected');
      expect(result.colorSource).toBe('name');
    });

    test('Book1: light blue row color wins over Status=Selected text', () => {
      const result = resolveStageFromRow({
        stageText: 'Selected',
        cellColors: {
          'Candidate Name': '#9BC2E6',
          Position: '#9BC2E6',
          Status: '#9BC2E6',
        },
        rowColors: ['#9BC2E6'],
      });
      expect(result.mainStage).toBe('hired');
      expect(result.colorSource).toBe('name');
    });

    test('uses status text when no colors present', () => {
      const result = resolveStageFromRow({
        stageText: 'Selected',
        cellColors: {},
      });
      expect(result.mainStage).toBe('selected');
      expect(result.colorSource).toBe('text');
    });

    test('infers rejected from remarks keywords', () => {
      const result = resolveStageFromRow({
        stageText: '',
        cellColors: {},
        remarks: 'Ditched Interview on 1st Jan',
      });
      expect(result.mainStage).toBe('rejected');
      expect(result.colorSource).toBe('remarks');
    });

    test('defaults to Applied when no signals', () => {
      const result = resolveStageFromRow({
        stageText: '',
        cellColors: {},
      });
      expect(result.mainStage).toBe('applied');
      expect(result.colorSource).toBe('fallback');
    });
  });
});
