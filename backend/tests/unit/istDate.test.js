/**
 * Unit tests for IST date parsing
 */

import { describe, test, expect } from '@jest/globals';
import {
  toISTYMD,
  parseDDMMYYYYToYMD,
  parseMMDDYYYYToYMD,
  parseSlashDateToYMD,
  excelMMDDToIntendedYMD,
  parseAppliedDateIST,
  isISTDateInInclusiveRange,
  todayISTYMD,
} from '../../utils/istDate.js';

describe('istDate', () => {
  test('parseDDMMYYYYToYMD parses unambiguous Indian format', () => {
    expect(parseDDMMYYYYToYMD('13/02/2026')).toBe('2026-02-13');
    expect(parseDDMMYYYYToYMD('14/04/2026')).toBe('2026-04-14');
  });

  test('parseMMDDYYYYToYMD parses US format', () => {
    expect(parseMMDDYYYYToYMD('07/11/2026')).toBe('2026-07-11');
    expect(parseMMDDYYYYToYMD('11/07/2026')).toBe('2026-11-07');
  });

  test('parseSlashDateToYMD uses MM/DD for ambiguous dates', () => {
    expect(parseSlashDateToYMD('07/11/2026')).toBe('2026-07-11');
    expect(parseSlashDateToYMD('13/02/2026')).toBe('2026-02-13');
  });

  test('excelMMDDToIntendedYMD swaps mm-dd-yy Date cells for Book1 trackers', () => {
    const nov7 = new Date(2026, 10, 7);
    expect(excelMMDDToIntendedYMD(nov7)).toBe('2026-07-11');
  });

  test('parseAppliedDateIST with excelNumFmt swaps Date objects', () => {
    const nov7 = new Date(2026, 10, 7);
    expect(parseAppliedDateIST(nov7, { excelNumFmt: 'mm-dd-yy' })).toBe('2026-07-11');
    expect(parseAppliedDateIST('07/11/2026')).toBe('2026-07-11');
  });

  test('parseAppliedDateIST uses IST calendar for plain Date objects', () => {
    const d = new Date('2026-11-07T00:00:00.000Z');
    expect(parseAppliedDateIST(d)).toBe('2026-11-07');
  });

  test('toISTYMD converts ISO datetimes to IST calendar day', () => {
    expect(toISTYMD('2026-11-06T18:30:00.000Z')).toBe('2026-11-07');
    expect(parseAppliedDateIST('2026-11-06T18:30:00.000Z')).toBe('2026-11-07');
  });

  test('toISTYMD keeps date-only strings unchanged', () => {
    expect(toISTYMD('2026-05-01')).toBe('2026-05-01');
  });

  test('todayISTYMD returns YYYY-MM-DD', () => {
    expect(todayISTYMD()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('isISTDateInInclusiveRange filters by IST calendar day', () => {
    expect(isISTDateInInclusiveRange('2026-06-15', '2026-06-01', '2026-06-30')).toBe(true);
    expect(isISTDateInInclusiveRange('2026-05-01', '2026-06-01', '2026-06-30')).toBe(false);
  });
});
