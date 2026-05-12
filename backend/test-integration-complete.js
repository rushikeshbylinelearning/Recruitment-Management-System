/**
 * Complete Integration Test
 * Tests the entire bulk upload stage mapping pipeline
 */

import { detectStage, getLegacyStage, normalizeText } from './services/stageMappingService.js';

console.log('🧪 Complete Stage Mapping Integration Test\n');
console.log('=' .repeat(70));

const testSuites = {
  'Text Matching - Exact': [
    { input: 'Applied', expected: { mainStage: 'applied', confidence: 1.0 } },
    { input: 'Follow Up', expected: { mainStage: 'follow-up', confidence: 1.0 } },
    { input: 'Screening', expected: { mainStage: 'screening', confidence: 1.0 } },
    { input: 'Interview', expected: { mainStage: 'interview', subStage: 'came-down', confidence: 1.0 } },
    { input: 'Offer', expected: { mainStage: 'offer', confidence: 1.0 } },
    { input: 'Hired', expected: { mainStage: 'hired', confidence: 1.0 } },
    { input: 'Rejected', expected: { mainStage: 'rejected', subStage: 'rejected', confidence: 1.0 } },
    { input: 'On Hold', expected: { mainStage: 'rejected', subStage: 'on-hold', confidence: 1.0 } },
  ],
  
  'Text Matching - Fuzzy': [
    { input: 'Aplied', expected: { mainStage: 'applied', minConfidence: 0.7 } },
    { input: 'Folowup', expected: { mainStage: 'follow-up', minConfidence: 0.7 } },
    { input: 'Screaning', expected: { mainStage: 'screening', minConfidence: 0.7 } },
    { input: 'Onhold', expected: { mainStage: 'rejected', subStage: 'on-hold', minConfidence: 0.7 } },
  ],
  
  'Color Matching - Main Stages': [
    { color: '#4169E1', expected: { mainStage: 'applied' } },
    { color: '#00B0F0', expected: { mainStage: 'follow-up' } },
    { color: '#FFC000', expected: { mainStage: 'screening' } },
    { color: '#FF6347', expected: { mainStage: 'interview', subStage: 'came-down' } },
    { color: '#9370DB', expected: { mainStage: 'offer' } },
    { color: '#00FF00', expected: { mainStage: 'hired' } },
    { color: '#FF0000', expected: { mainStage: 'rejected', subStage: 'rejected' } },
  ],
  
  'Color Matching - Umbrella Sub-Stages': [
    { color: '#FFA500', expected: { mainStage: 'rejected', subStage: 'on-hold' } },
    { color: '#E74C3C', expected: { mainStage: 'rejected', subStage: 'profile-not-matched' } },
    { color: '#FF6B6B', expected: { mainStage: 'rejected', subStage: 'last-minute-back-out' } },
    { color: '#DC143C', expected: { mainStage: 'interview', subStage: 'no-show' } },
    { color: '#32CD32', expected: { mainStage: 'interview', subStage: 'selected-interview' } },
  ],
  
  'Priority - Text Over Color': [
    { input: 'On Hold', color: '#4169E1', expected: { mainStage: 'rejected', subStage: 'on-hold', confidence: 1.0 } },
    { input: 'Screening', color: '#FF0000', expected: { mainStage: 'screening', confidence: 1.0 } },
    { input: 'Hired', color: '#FFC000', expected: { mainStage: 'hired', confidence: 1.0 } },
  ],
  
  'Legacy Stage Mapping': [
    { mainStage: 'applied', subStage: null, expectedLegacy: 'Applied' },
    { mainStage: 'follow-up', subStage: null, expectedLegacy: 'Follow Up' },
    { mainStage: 'screening', subStage: null, expectedLegacy: 'Screening' },
    { mainStage: 'interview', subStage: 'came-down', expectedLegacy: 'Interview' },
    { mainStage: 'interview', subStage: 'no-show', expectedLegacy: 'Interview' },
    { mainStage: 'offer', subStage: null, expectedLegacy: 'Offer' },
    { mainStage: 'hired', subStage: null, expectedLegacy: 'Hired' },
    { mainStage: 'rejected', subStage: 'rejected', expectedLegacy: 'Rejected' },
    { mainStage: 'rejected', subStage: 'on-hold', expectedLegacy: 'On Hold' },
    { mainStage: 'rejected', subStage: 'profile-not-matched', expectedLegacy: 'Profile Not Matched' },
    { mainStage: 'rejected', subStage: 'last-minute-back-out', expectedLegacy: 'Last Minute Back Out' },
  ],
};

let totalPassed = 0;
let totalFailed = 0;

for (const [suiteName, tests] of Object.entries(testSuites)) {
  console.log(`\n\n📋 ${suiteName}`);
  console.log('-'.repeat(70));
  
  let suitePassed = 0;
  let suiteFailed = 0;
  
  tests.forEach((test, index) => {
    if (test.expectedLegacy !== undefined) {
      // Legacy stage mapping test
      const result = getLegacyStage(test.mainStage, test.subStage);
      const pass = result === test.expectedLegacy;
      
      console.log(`\n${index + 1}. getLegacyStage('${test.mainStage}', '${test.subStage || 'null'}')`);
      console.log(`   Expected: "${test.expectedLegacy}"`);
      console.log(`   Got: "${result}"`);
      console.log(`   ${pass ? '✅ PASS' : '❌ FAIL'}`);
      
      if (pass) suitePassed++; else suiteFailed++;
      
    } else {
      // Stage detection test
      const result = detectStage({
        cellValue: test.input || '',
        cellColor: test.color || null,
        allowFuzzyMatch: true,
        confidenceThreshold: 0.7
      });
      
      const mainStageMatch = result.mainStage === test.expected.mainStage;
      const subStageMatch = (result.subStage || null) === (test.expected.subStage || null);
      const confidenceMatch = test.expected.confidence 
        ? result.confidence === test.expected.confidence
        : test.expected.minConfidence
          ? result.confidence >= test.expected.minConfidence
          : true;
      
      const pass = mainStageMatch && subStageMatch && confidenceMatch;
      
      console.log(`\n${index + 1}. ${test.input ? `Text: "${test.input}"` : `Color: ${test.color}`}`);
      console.log(`   Expected: mainStage="${test.expected.mainStage}", subStage="${test.expected.subStage || 'null'}"`);
      console.log(`   Got: mainStage="${result.mainStage}", subStage="${result.subStage || 'null'}"`);
      console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%, Method: ${result.matchMethod}`);
      console.log(`   ${pass ? '✅ PASS' : '❌ FAIL'}`);
      
      if (pass) suitePassed++; else suiteFailed++;
    }
  });
  
  console.log(`\n   Suite Results: ${suitePassed} passed, ${suiteFailed} failed`);
  totalPassed += suitePassed;
  totalFailed += suiteFailed;
}

console.log('\n\n' + '='.repeat(70));
console.log(`\n📊 TOTAL RESULTS: ${totalPassed} passed, ${totalFailed} failed out of ${totalPassed + totalFailed} tests`);

if (totalFailed === 0) {
  console.log('\n✅ ALL TESTS PASSED! Stage mapping integration is working correctly.\n');
  process.exit(0);
} else {
  console.log(`\n❌ ${totalFailed} test(s) failed. Review the output above.\n`);
  process.exit(1);
}
