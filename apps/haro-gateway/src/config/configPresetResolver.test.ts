import { resolveConfigPreset } from './configPresetResolver';
import { kvGet, kvSet } from './kvCrypto';
import { neonQuery } from './neonClient';
import type { GatewayEnv } from './types';

jest.mock('./kvCrypto', () => ({
  kvGet: jest.fn(),
  kvSet: jest.fn(),
}));
jest.mock('./neonClient', () => ({
  neonQuery: jest.fn(),
}));

const mockEnv = {
  DATABASE_URL: 'postgresql://u:p@ep-test.neon.tech/db',
  KV_ENCRYPTION_KEY: 'key',
  HARO_CONFIG_CACHE: {},
} as unknown as GatewayEnv;

describe('resolveConfigPreset', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null for empty slug', async () => {
    expect(await resolveConfigPreset('', mockEnv)).toBeNull();
  });

  it('returns cached config on KV HIT', async () => {
    const config = { strategy: 'fallback', targets: [] };
    (kvGet as jest.Mock).mockResolvedValueOnce(config);
    const result = await resolveConfigPreset('cfg_abc123', mockEnv);
    expect(result).toEqual(config);
    expect(neonQuery).not.toHaveBeenCalled();
  });

  it('queries Neon gateway_configs on MISS and caches', async () => {
    (kvGet as jest.Mock).mockResolvedValueOnce(null);
    const config = { strategy: 'loadbalance' };
    (neonQuery as jest.Mock).mockResolvedValueOnce([{ config }]);
    const result = await resolveConfigPreset('cfg_abc123', mockEnv);
    expect(result).toEqual(config);
    expect(neonQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT config FROM public.gateway_configs'),
      ['cfg_abc123'],
      mockEnv
    );
    expect(kvSet).toHaveBeenCalledWith('cfg:cfg_abc123', config, mockEnv, 600);
  });
});
