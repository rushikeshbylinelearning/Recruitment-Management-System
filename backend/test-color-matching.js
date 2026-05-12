/**
 * Test Color Matching Integration
 * Verifies that findBestColorMatch() correctly identifies stages from colors
 */

import { detectStage } from './services/stageMappingService.js';

console.log('🧪 Testing Color Matching Integration\n');
console.log('=' .repeat(60));

const testCases = [
  {
    name: 'Follow Up - Cyan #00B0F0',
    cellValue: '',
    cellColor: '#00B0F0',
    expected: { mainStage: 'follow-up', legacyStage: 'Follow Up' }
  },
  {
    name: 'Screening - Amber #FFC000',
    cellValue: '',
    cellColor: '#FFC000',
    expected: { mainStage: 'screening', legacyStage: 'Screening' }
  },
  {
    name: 'On Hold - Orange #FFA500',
    cellValue: '',
    cellColor: '#FFA500',
    expected: { mainStage: 'rejected', subStage: 'on-hold', legacyStage: 'On Hold' }
  },
  {
    name: 'Applied - Blue #4169E1',
    cellValue: '',
    cellColor: '#4169E1',
    expected: { mainStage: 'applied', legacyStage: 'Applied' }
  },
  {
    name: 'Interview - Orange #FF6347',
    cellValue: '',
    cellColor: '#FF6347',
    expected: { mainStage: 'interview', subStage: 'came-down', legacyStage: 'Interview' }
  },
  {
    name: 'Rejected - Red #FF0000',
    cellValue: '',
    cellColor: '#FF0000',
    expected: { mainStage: 'rejected', subStage: 'rejected', legacyStage: 'Rejected' }
  },
  {
    name: 'Hired - Green #00FF00',
    cellValue: '',
    cellColor: '#00FF00',
    expected: { mainStage: 'hired', legacyStage: 'Hired' }
  },
  {
    name: 'Offer - Purple #9370DB',
    cellValue: '',
    cellColor: '#9370DB',
    expected: { mainStage: 'offer', legacyStage: 'Offer' }
  },
  {
    name: 'Profile Not Matched - Dark Red #E74C3C',
    cellValue: '',
    cellColor: '#E74C3C',
    expected: { mainStage: 'rejected', subStage: 'profile-not-matched', legacyStage: 'Profile Not Matched' }
  },
  {
    name: 'Last Minute Back Out - Light Red #FF6B6B',
    cellValue: '',
    cellColor: '#FF6B6B',
    expected: { mainStage: 'rejected', subStage: 'last-minute-back-out', legacyStage: 'Last Minute Back Out' }
  },
  {
    name: 'No Show - Crimson #DC143C',
    cellValue: '',
    cellColor: '#DC143C',
    expected: { mainStage: 'interview', subStage: 'no-show', legacyStage: 'Interview' }
  },
  {
    name: 'Text Override - "On Hold" with Blue color',
    cellValue: 'On Hold',
    cellColor: '#4169E1',
    expected: { mainStage: 'rejected', subStage: 'on-hold', legacyStage: 'On Hold' }
  }
];

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  console.log(`\n${index + 1}. ${test.name}`);
  console.log(`   Input: cellValue="${test.cellValue}", cellColor="${test.cellColor}"`);
  
  const result = detectStage({
    cellValue: test.cellValue,
    cellColor: test.cellColor,
    allowFuzzyMatch: true,
    confidenceThreshold: 0.7
  });
  
  console.log(`   Result: mainStage="${result.mainStage}", subStage="${result.subStage || 'null'}", legacyStage="${result.legacyStage}"`);
  console.log(`   Confidence: ${(result.confidence * 100).toFixed(0)}%, Method: ${result.matchMethod}`);
  
  const mainStageMatch = result.mainStage === test.expected.mainStage;
  const subStageMatch = (result.subStage || null) === (test.expected.subStage || null);
  const legacyStageMatch = result.legacyStage === test.expected.legacyStage;
  
  if (mainStageMatch && subStageMatch && legacyStageMatch) {
    console.log(`   ✅ PASS`);
    passed++;
  } else {
    console.log(`   ❌ FAIL`);
    console.log(`   Expected: mainStage="${test.expected.mainStage}", subStage="${test.expected.subStage || 'null'}", legacyStage="${test.expected.legacyStage}"`);
    failed++;
  }
});

console.log('\n' + '='.repeat(60));
console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('✅ All tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed. Review the output above.');
  process.exit(1);
}
