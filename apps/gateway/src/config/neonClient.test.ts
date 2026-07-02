import { neonQuery } from './neonClient';
import type { GatewayEnv } from './types';

describe('neonQuery', () => {
  it('sends post request with correct query and params to Neon HTTP API', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [{ id: '1', name: 'Test' }] })
    });
    global.fetch = mockFetch as any;

    const env = {
      DATABASE_URL: 'postgresql://user:pass@ep-test-123.us-east-1.aws.neon.tech/neondb'
    } as unknown as GatewayEnv;

    const result = await neonQuery('SELECT * FROM test WHERE id = $1', ['val'], env);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://ep-test-123.us-east-1.aws.neon.tech/sql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer pass'
        }),
        body: JSON.stringify({
          query: 'SELECT * FROM test WHERE id = $1',
          params: ['val']
        })
      })
    );
    expect(result).toEqual([{ id: '1', name: 'Test' }]);
  });
});
