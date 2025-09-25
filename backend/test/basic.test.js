import request from 'supertest';
import app from '../server.js';

describe('Basic API Tests', () => {
  test('Health check endpoint should work', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'Server is running');
  });

  test('API info endpoint should work', async () => {
    const response = await request(app)
      .get('/api')
      .expect(200);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message', 'HR Workflow Management API');
    expect(response.body).toHaveProperty('endpoints');
  });

  test('Non-existent endpoint should return 404', async () => {
    const response = await request(app)
      .get('/api/non-existent')
      .expect(404);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });

  test('Protected endpoint should require authentication', async () => {
    const response = await request(app)
      .get('/api/users')
      .expect(401);

    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message', 'Access token required');
  });
});

