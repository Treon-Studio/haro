import { supabaseFetch } from './supabaseClient';
import type { GatewayEnv } from './types';

describe('supabaseFetch', () => {
  it('adds Authorization and apikey headers', async () => {
    const mockFetch = jest.fn().mockResolvedValue(new Response('[]'));
    global.fetch = mockFetch as any;

    const env = {
      SUPABASE_URL: 'https://abc.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key-xxx',
    } as unknown as GatewayEnv;

    await supabaseFetch('/rest/v1/gateway_virtual_keys?slug=eq.vk_test', env);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://abc.supabase.co/rest/v1/gateway_virtual_keys?slug=eq.vk_test',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer service-key-xxx',
          apikey: 'service-key-xxx',
        }),
      })
    );
  });
});
