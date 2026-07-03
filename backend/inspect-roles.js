import { query } from './config/database.js';

async function inspectRoles() {
  try {
    console.log('\n=== STEP 1: UNIQUE ROLES IN DATABASE ===\n');
    
    const rows = await query(`
      SELECT position, COUNT(*) as count 
      FROM candidates 
      WHERE position IS NOT NULL AND TRIM(position) != ''
      GROUP BY position
      ORDER BY count DESC
    `);
    
    console.log(`Total unique roles: ${rows.length}\n`);
    rows.forEach((row, idx) => {
      console.log(`${idx + 1}. "${row.position}" - ${row.count} candidates`);
    });

    // Check for duplicates/variations
    console.log('\n=== STEP 2: CHECKING FOR VARIATIONS ===\n');
    
    const roleMap = new Map();
    rows.forEach(row => {
      const normalized = row.position
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/-/g, ' ')
        .trim();
      
      if (!roleMap.has(normalized)) {
        roleMap.set(normalized, []);
      }
      roleMap.get(normalized).push(row.position);
    });

    let duplicateCount = 0;
    roleMap.forEach((variations, normalized) => {
      if (variations.length > 1) {
        duplicateCount++;
        console.log(`\nNormalized: "${normalized}"`);
        variations.forEach(v => console.log(`  - "${v}"`));
      }
    });
    
    console.log(`\nTotal normalized groups with variations: ${duplicateCount}`);

    // Check mapping coverage
    console.log('\n=== STEP 3: CHECKING MAPPING COVERAGE ===\n');
    
    const mapping = JSON.parse(require('fs').readFileSync('./jobCardCategoryMapping.json', 'utf8'));
    const { categories } = mapping;
    
    const allMappedRoles = new Set();
    Object.values(categories).forEach(roleList => {
      roleList.forEach(role => {
        const normalized = role
          .toLowerCase()
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/-/g, ' ')
          .trim();
        allMappedRoles.add(normalized);
      });
    });

    console.log(`Total mapped role variations: ${allMappedRoles.size}`);
    
    const unmappedRoles = [];
    rows.forEach(row => {
      const normalized = row.position
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/-/g, ' ')
        .trim();
      
      if (!allMappedRoles.has(normalized)) {
        unmappedRoles.push({ role: row.position, count: row.count, normalized });
      }
    });

    if (unmappedRoles.length > 0) {
      console.log(`\n⚠️  UNMAPPED ROLES (${unmappedRoles.length}):`);
      unmappedRoles.forEach(u => {
        console.log(`  - "${u.role}" (${u.count} candidates) [normalized: "${u.normalized}"]`);
      });
    } else {
      console.log('\n✅ All roles are mapped!');
    }

    // Test aggregation
    console.log('\n=== STEP 4: TESTING AGGREGATION ===\n');
    
    const { computeJobCardApplicantTotals } = await import('./services/jobCardCategoryAggregation.js');
    const totals = await computeJobCardApplicantTotals(query);
    
    console.log('Job Card Totals:');
    Object.entries(totals).forEach(([card, count]) => {
      console.log(`  ${card}: ${count}`);
    });

    // Verify totals match
    const totalFromAggregation = Object.values(totals).reduce((a, b) => a + b, 0);
    const totalFromDB = rows.reduce((a, b) => a + b.count, 0);
    
    console.log(`\nTotal from aggregation: ${totalFromAggregation}`);
    console.log(`Total from DB: ${totalFromDB}`);
    console.log(`Match: ${totalFromAggregation === totalFromDB ? '✅ YES' : '❌ NO'}`);

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
  }
  process.exit(0);
}

inspectRoles();
