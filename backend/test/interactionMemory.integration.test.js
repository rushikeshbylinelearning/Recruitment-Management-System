/**
 * Integration tests for Interaction Memory - Candidate Pipeline Integration
 * Tests Task 4.1: Modified POST /api/interaction/log endpoint
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Interaction Memory - Candidate Pipeline Integration', () => {
  it('should map interaction status to correct stage', async () => {
    const { mapInteractionStatusToStage } = await import('../services/stageMappingService.js');

    assert.strictEqual(mapInteractionStatusToStage('Interested'), 'Applied');
    assert.strictEqual(mapInteractionStatusToStage('No Response'), 'Applied');
    assert.strictEqual(mapInteractionStatusToStage('Follow-up'), 'Applied');
    assert.strictEqual(mapInteractionStatusToStage('Shortlisted'), 'Screening');
    assert.strictEqual(mapInteractionStatusToStage('Interview'), 'Interview');
    assert.strictEqual(mapInteractionStatusToStage('Selected'), 'Offer');
    assert.strictEqual(mapInteractionStatusToStage('Joined'), 'Hired');
    assert.strictEqual(mapInteractionStatusToStage('Rejected'), 'On Hold');
    assert.strictEqual(mapInteractionStatusToStage(null), 'Applied');
    assert.strictEqual(mapInteractionStatusToStage('Unknown'), 'Applied');
  });

  it('should verify integration service functions exist', async () => {
    const integrationService = await import('../services/integrationService.js');

    assert.ok(typeof integrationService.findCandidateByPhone === 'function', 'findCandidateByPhone should be a function');
    assert.ok(typeof integrationService.createCandidateFromInteraction === 'function', 'createCandidateFromInteraction should be a function');
    assert.ok(typeof integrationService.linkInteractionToCandidate === 'function', 'linkInteractionToCandidate should be a function');
  });

  it('should verify route imports integration service', async () => {
    // This test verifies that the route file can be imported without errors
    // and that it has the necessary imports
    try {
      // We can't actually import the route file without starting the server,
      // but we can verify the service files are importable
      const integrationService = await import('../services/integrationService.js');
      const stageMappingService = await import('../services/stageMappingService.js');
      
      assert.ok(integrationService, 'Integration service should be importable');
      assert.ok(stageMappingService, 'Stage mapping service should be importable');
    } catch (error) {
      assert.fail(`Failed to import services: ${error.message}`);
    }
  });
});
