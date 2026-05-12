/**
 * Color-Driven Workflow System - Comprehensive Test Suite
 * 
 * Tests the enterprise-grade color-driven stage detection system
 * with unique colors for all main stages and micro-stages.
 */

import { STAGE_COLOR_MAP, validateColorUniqueness, getColorLegend } from './config/stageColorMapping.js';
import { 
  normalizeColor, 
  detectStageByColor, 
  hexToRgb,
  calculateRgbDistance 
} from './services/colorDetectionEngine.js';
import { detectStage } from './services/stageMappingService.js';

console.log('🧪 COLOR-DRIVEN WORKFLOW SYSTEM - COMPREHENSIVE TEST SUITE\n');
console.log('='.repeat(80));

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`✅ ${name}`);
    passedTests++;
  } catch (error) {
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
    failedTests++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// ============================================================================
// TEST SUITE 1: COLOR UNIQUENESS VALIDATION
// ============================================================================
console.log('\n📋 TEST SUITE 1: Color Uniqueness Validation');
console.log('-'.repeat(80));

test('All primary colors are unique', () => {
  const result = validateColorUniqueness();
  assert(result === true, 'Color uniqueness validation failed');
});

test('No duplicate colors across all stages', () => {
  const colors = Object.values(STAGE_COLOR_MAP).map(c => c.color.toUpperCase());
  const uniqueColors = new Set(colors);
  assert(colors.length === uniqueColors.size, `Found ${colors.length - uniqueColors.size} duplicate colors`);
});

test('All 16 stages have assigned colors', () => {
  const stageCount = Object.keys(STAGE_COLOR_MAP).length;
  assert(stageCount === 16, `Expected 16 stages, found ${stageCount}`);
});

// ============================================================================
// TEST SUITE 2: COLOR NORMALIZATION
// ============================================================================
console.log('\n📋 TEST SUITE 2: Color Normalization');
console.log('-'.repeat(80));

test('Normalize standard hex color (#RRGGBB)', () => {
  const result = normalizeColor('#2563EB');
  assert(result === '#2563EB', `Expected #2563EB, got ${result}`);
});

test('Normalize hex without # prefix (RRGGBB)', () => {
  const result = normalizeColor('2563EB');
  assert(result === '#2563EB', `Expected #2563EB, got ${result}`);
});

test('Normalize Excel ARGB format (AARRGGBB)', () => {
  const result = normalizeColor('FF2563EB');
  assert(result === '#2563EB', `Expected #2563EB, got ${result}`);
});

test('Normalize Excel ARGB with # prefix (#AARRGGBB)', () => {
  const result = normalizeColor('#FF2563EB');
  assert(result === '#2563EB', `Expected #2563EB, got ${result}`);
});

test('Handle lowercase hex colors', () => {
  const result = normalizeColor('#2563eb');
  assert(result === '#2563EB', `Expected #2563EB, got ${result}`);
});

test('Return null for invalid color format', () => {
  const result = normalizeColor('invalid');
  assert(result === null, `Expected null, got ${result}`);
});

// ============================================================================
// TEST SUITE 3: MAIN STAGE COLOR DETECTION
// ============================================================================
console.log('\n📋 TEST SUITE 3: Main Stage Color Detection');
console.log('-'.repeat(80));

const mainStageTests = [
  { color: '#2563EB', expected: 'applied', label: 'Applied (Royal Blue)' },
  { color: '#F59E0B', expected: 'follow-up', label: 'Follow Up (Amber)' },
  { color: '#06B6D4', expected: 'screening', label: 'Screening (Cyan)' },
  { color: '#8B5CF6', expected: 'interview', label: 'Interview (Violet)' },
  { color: '#EC4899', expected: 'offer', label: 'Offer (Pink)' },
  { color: '#10B981', expected: 'hired', label: 'Hired (Emerald Green)' },
  { color: '#DC2626', expected: 'rejected', label: 'Rejected (Crimson)' }
];

mainStageTests.forEach(({ color, expected, label }) => {
  test(`Detect ${label}`, () => {
    const result = detectStageByColor(color);
    assert(result !== null, `Failed to detect stage for ${color}`);
    assert(result.mainStage === expected, `Expected ${expected}, got ${result.mainStage}`);
    assert(result.confidence === 1.0, `Expected confidence 1.0, got ${result.confidence}`);
  });
});

// ============================================================================
// TEST SUITE 4: INTERVIEW MICRO-STAGE COLOR DETECTION
// ============================================================================
console.log('\n📋 TEST SUITE 4: Interview Micro-Stage Color Detection');
console.log('-'.repeat(80));

const interviewMicroTests = [
  { color: '#A78BFA', expected: 'follow-up-interview', label: 'Follow Up (Interview) - Light Violet' },
  { color: '#4F46E5', expected: 'came-down', label: 'Came Down - Deep Indigo' },
  { color: '#FB923C', expected: 'no-show', label: "Didn't Come - Light Orange" },
  { color: '#22C55E', expected: 'selected-interview', label: 'Selected (Interview) - Green' },
  { color: '#BE123C', expected: 'rejected-interview', label: 'Rejected (Interview) - Deep Rose' }
];

interviewMicroTests.forEach(({ color, expected, label }) => {
  test(`Detect ${label}`, () => {
    const result = detectStageByColor(color);
    assert(result !== null, `Failed to detect stage for ${color}`);
    assert(result.mainStage === 'interview', `Expected mainStage 'interview', got ${result.mainStage}`);
    assert(result.subStage === expected, `Expected subStage ${expected}, got ${result.subStage}`);
  });
});

// ============================================================================
// TEST SUITE 5: REJECTED MICRO-STAGE COLOR DETECTION
// ============================================================================
console.log('\n📋 TEST SUITE 5: Rejected Micro-Stage Color Detection');
console.log('-'.repeat(80));

const rejectedMicroTests = [
  { color: '#EAB308', expected: 'on-hold', label: 'On Hold - Yellow' },
  { color: '#64748B', expected: 'profile-not-matched', label: 'Profile Not Matched - Slate Gray' },
  { color: '#EA580C', expected: 'last-minute-back-out', label: 'Last Minute Back Out - Dark Orange' },
  { color: '#B91C1C', expected: 'rejected', label: 'Rejected - Dark Red' }
];

rejectedMicroTests.forEach(({ color, expected, label }) => {
  test(`Detect ${label}`, () => {
    const result = detectStageByColor(color);
    assert(result !== null, `Failed to detect stage for ${color}`);
    assert(result.mainStage === 'rejected', `Expected mainStage 'rejected', got ${result.mainStage}`);
    assert(result.subStage === expected, `Expected subStage ${expected}, got ${result.subStage}`);
  });
});

// ============================================================================
// TEST SUITE 6: EXCEL ARGB FORMAT SUPPORT
// ============================================================================
console.log('\n📋 TEST SUITE 6: Excel ARGB Format Support');
console.log('-'.repeat(80));

test('Detect Applied from Excel ARGB format (FF2563EB)', () => {
  const result = detectStageByColor('FF2563EB');
  assert(result !== null, 'Failed to detect stage');
  assert(result.mainStage === 'applied', `Expected 'applied', got ${result.mainStage}`);
});

test('Detect Screening from Excel ARGB format (FF06B6D4)', () => {
  const result = detectStageByColor('FF06B6D4');
  assert(result !== null, 'Failed to detect stage');
  assert(result.mainStage === 'screening', `Expected 'screening', got ${result.mainStage}`);
});

// ============================================================================
// TEST SUITE 7: RGB TOLERANCE MATCHING
// ============================================================================
console.log('\n📋 TEST SUITE 7: RGB Tolerance Matching');
console.log('-'.repeat(80));

test('Detect Applied with slight color variation', () => {
  // #2563EB (Applied) with slight variation
  const result = detectStageByColor('#2563EC'); // Changed last digit
  assert(result !== null, 'Failed to detect stage with tolerance');
  assert(result.mainStage === 'applied', `Expected 'applied', got ${result.mainStage}`);
  assert(result.confidence < 1.0, 'Expected confidence < 1.0 for tolerance match');
});

test('Detect Hired with tolerance shade', () => {
  // Use a tolerance shade from config
  const result = detectStageByColor('#059669'); // Tolerance shade for Hired
  assert(result !== null, 'Failed to detect stage');
  assert(result.mainStage === 'hired', `Expected 'hired', got ${result.mainStage}`);
});

// ============================================================================
// TEST SUITE 8: TEXT + COLOR PRIORITY
// ============================================================================
console.log('\n📋 TEST SUITE 8: Text + Color Priority');
console.log('-'.repeat(80));

test('Text match takes priority over color', () => {
  // Text says "Applied" but color is crimson (Rejected)
  const result = detectStage({
    cellValue: 'Applied',
    cellColor: '#DC2626', // Crimson (Rejected color)
    allowFuzzyMatch: true
  });
  assert(result.mainStage === 'applied', `Expected 'applied', got ${result.mainStage}`);
  assert(result.matchMethod === 'exact', `Expected 'exact', got ${result.matchMethod}`);
  assert(result.confidence === 1.0, 'Expected confidence 1.0 for text match');
});

test('Color match when no text provided', () => {
  const result = detectStage({
    cellValue: '',
    cellColor: '#10B981', // Hired color
    allowFuzzyMatch: true
  });
  assert(result.mainStage === 'hired', `Expected 'hired', got ${result.mainStage}`);
  assert(result.matchMethod.includes('color'), `Expected color match method, got ${result.matchMethod}`);
});

// ============================================================================
// TEST SUITE 9: EDGE CASES
// ============================================================================
console.log('\n📋 TEST SUITE 9: Edge Cases');
console.log('-'.repeat(80));

test('Handle null color', () => {
  const result = detectStageByColor(null);
  assert(result === null, 'Expected null for null color');
});

test('Handle empty string color', () => {
  const result = detectStageByColor('');
  assert(result === null, 'Expected null for empty color');
});

test('Handle invalid hex color', () => {
  const result = detectStageByColor('ZZZZZZ');
  assert(result === null, 'Expected null for invalid color');
});

test('Handle color with no match', () => {
  // Use a color that doesn't match any stage (pure white)
  const result = detectStageByColor('#FFFFFF', { tolerance: 10 });
  assert(result === null, 'Expected null for unmatched color');
});

// ============================================================================
// TEST SUITE 10: RGB DISTANCE CALCULATION
// ============================================================================
console.log('\n📋 TEST SUITE 10: RGB Distance Calculation');
console.log('-'.repeat(80));

test('Calculate distance between identical colors', () => {
  const rgb1 = hexToRgb('#2563EB');
  const rgb2 = hexToRgb('#2563EB');
  const distance = calculateRgbDistance(rgb1, rgb2);
  assert(distance === 0, `Expected distance 0, got ${distance}`);
});

test('Calculate distance between different colors', () => {
  const rgb1 = hexToRgb('#000000'); // Black
  const rgb2 = hexToRgb('#FFFFFF'); // White
  const distance = calculateRgbDistance(rgb1, rgb2);
  assert(distance > 400, `Expected distance > 400, got ${distance}`);
});

// ============================================================================
// TEST SUITE 11: COLOR LEGEND EXPORT
// ============================================================================
console.log('\n📋 TEST SUITE 11: Color Legend Export');
console.log('-'.repeat(80));

test('Export color legend for UI', () => {
  const legend = getColorLegend();
  assert(Array.isArray(legend), 'Legend should be an array');
  assert(legend.length === 16, `Expected 16 entries, got ${legend.length}`);
  assert(legend[0].stageId, 'Each entry should have stageId');
  assert(legend[0].label, 'Each entry should have label');
  assert(legend[0].color, 'Each entry should have color');
});

// ============================================================================
// FINAL RESULTS
// ============================================================================
console.log('\n' + '='.repeat(80));
console.log(`\n📊 TEST RESULTS: ${passedTests}/${totalTests} passed, ${failedTests} failed`);

if (failedTests === 0) {
  console.log('\n✅ ALL TESTS PASSED! Color-driven workflow system is working correctly.\n');
  console.log('🎯 SYSTEM READY FOR PRODUCTION');
  console.log('   - All 16 stages have unique colors');
  console.log('   - Color normalization supports Excel ARGB format');
  console.log('   - RGB tolerance matching works correctly');
  console.log('   - Text matching takes priority over color');
  console.log('   - Edge cases handled gracefully\n');
  process.exit(0);
} else {
  console.log(`\n❌ ${failedTests} test(s) failed. Review the output above.\n`);
  process.exit(1);
}
