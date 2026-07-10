import {
  validateEventTitle,
  validateDate,
  validateTime,
  validateColour,
  validateCategorySlug,
  parseDateRange,
} from '../../utils/calendarValidation.js';

describe('calendarValidation', () => {
  describe('validateEventTitle', () => {
    it('rejects empty titles', () => {
      expect(validateEventTitle('').valid).toBe(false);
      expect(validateEventTitle('  ').valid).toBe(false);
    });
    it('accepts valid titles', () => {
      const r = validateEventTitle('Team Meeting');
      expect(r.valid).toBe(true);
      expect(r.value).toBe('Team Meeting');
    });
  });

  describe('validateDate', () => {
    it('accepts ISO date strings', () => {
      const r = validateDate('2026-07-09');
      expect(r.valid).toBe(true);
      expect(r.value).toBe('2026-07-09');
    });
    it('rejects invalid dates', () => {
      expect(validateDate('not-a-date').valid).toBe(false);
    });
  });

  describe('validateTime', () => {
    it('accepts HH:MM format', () => {
      const r = validateTime('09:30');
      expect(r.valid).toBe(true);
      expect(r.value).toBe('09:30:00');
    });
    it('allows null/empty', () => {
      expect(validateTime('').valid).toBe(true);
    });
  });

  describe('validateColour', () => {
    it('accepts hex colours', () => {
      expect(validateColour('#3B82F6').valid).toBe(true);
    });
    it('rejects invalid colours', () => {
      expect(validateColour('blue').valid).toBe(false);
    });
  });

  describe('validateCategorySlug', () => {
    it('accepts meeting category', () => {
      expect(validateCategorySlug('meeting').valid).toBe(true);
    });
    it('rejects planner_task (not stored in calendar_events)', () => {
      expect(validateCategorySlug('planner_task').valid).toBe(false);
    });
  });

  describe('parseDateRange', () => {
    it('validates start before end', () => {
      const r = parseDateRange('2026-07-01', '2026-07-31');
      expect(r.valid).toBe(true);
      expect(r.start).toBe('2026-07-01');
      expect(r.end).toBe('2026-07-31');
    });
    it('rejects inverted range', () => {
      expect(parseDateRange('2026-07-31', '2026-07-01').valid).toBe(false);
    });
  });
});
