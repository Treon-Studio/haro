import { resolveVirtualKey } from './virtualKeyResolver';
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
  KV_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  HARO_CONFIG_CACHE: {},
} as unknown as GatewayEnv;

// Helper to encrypt a test key using Web Crypto
async function encryptKey(plaintext: string, base64Key: string): Promise<string> {
  const getCrypto = (): any => (globalThis as any).crypto;
  const rawKey = Uint8Array.from(atob(base64Key), (c) => c.charCodeAt(0));
  const cryptoKey = await getCrypto().subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt']);
  const iv = getCrypto().getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await getCrypto().subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);
  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

describe('resolveVirtualKey', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('returns null if slug is empty', async () => {
    const result = await resolveVirtualKey('', mockEnv);
    expect(result).toBeNull();
  });

  it('returns cached value from KV on HIT', async () => {
    (kvGet as jest.Mock).mockResolvedValueOnce({
      provider: 'openai',
      apiKey: 'sk-cached',
      rateLimitRpm: 100,
    });

    const result = await resolveVirtualKey('vk_abc123', mockEnv);
    expect(result).toEqual({
      provider: 'openai',
      apiKey: 'sk-cached',
      rateLimitRpm: 100,
    });
    expect(neonQuery).not.toHaveBeenCalled();
    expect(kvGet).toHaveBeenCalledWith('vk:vk_abc123', mockEnv);
  });

  it('queries Neon on KV MISS, decrypts key and caches result', async () => {
    (kvGet as jest.Mock).mockResolvedValueOnce(null);

    const rawApiKey = 'sk-real-secret-123';
    const encryptedKey = await encryptKey(rawApiKey, mockEnv.KV_ENCRYPTION_KEY);

    const mockVkResponse = [
      {
        slug: 'vk_abc123',
        provider: 'openai',
        encrypted_key: encryptedKey,
        is_active: true,
        rate_limit_rpm: 60,
      },
    ];

    (neonQuery as jest.Mock).mockResolvedValueOnce(mockVkResponse);

    const result = await resolveVirtualKey('vk_abc123', mockEnv);
    expect(result).toEqual({
      provider: 'openai',
      apiKey: rawApiKey,
      rateLimitRpm: 60,
    });

    expect(neonQuery).toHaveBeenCalledWith(
      expect.stringContaining('SELECT slug, provider, encrypted_key, rate_limit_rpm, is_active FROM public.gateway_virtual_keys'),
      ['vk_abc123'],
      mockEnv
    );
    expect(kvSet).toHaveBeenCalledWith('vk:vk_abc123', result, mockEnv, 60);
  });

  it('returns null if virtual key is inactive or not found', async () => {
    (kvGet as jest.Mock).mockResolvedValueOnce(null);
    (neonQuery as jest.Mock).mockResolvedValueOnce([]);

    const result = await resolveVirtualKey('vk_not_exist', mockEnv);
    expect(result).toBeNull();
    expect(kvSet).not.toHaveBeenCalled();
  });

  it('gracefully handles decryption failures by returning null', async () => {
    (kvGet as jest.Mock).mockResolvedValueOnce(null);

    const mockVkResponse = [
      {
        slug: 'vk_abc123',
        provider: 'openai',
        encrypted_key: 'invalid-encrypted-base64',
        is_active: true,
        rate_limit_rpm: 60,
      },
    ];

    (neonQuery as jest.Mock).mockResolvedValueOnce(mockVkResponse);

    const result = await resolveVirtualKey('vk_abc123', mockEnv);
    expect(result).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(kvSet).not.toHaveBeenCalled();
  });

  it('coalesces multiple concurrent identical in-flight requests', async () => {
    (kvGet as jest.Mock).mockResolvedValue(null);

    const rawApiKey = 'sk-coalesced';
    const encryptedKey = await encryptKey(rawApiKey, mockEnv.KV_ENCRYPTION_KEY);

    const mockVkResponse = [
      {
        slug: 'vk_abc123',
        provider: 'openai',
        encrypted_key: encryptedKey,
        is_active: true,
        rate_limit_rpm: 60,
      },
    ];

    // Neon query mock that delays a bit to allow concurrent requests
    let resolver: (value: any) => void = () => {};
    const delayPromise = new Promise((resolve) => {
      resolver = resolve;
    });

    (neonQuery as jest.Mock).mockImplementation(() => delayPromise);

    const p1 = resolveVirtualKey('vk_abc123', mockEnv);
    const p2 = resolveVirtualKey('vk_abc123', mockEnv);
    const p3 = resolveVirtualKey('vk_abc123', mockEnv);

    // Resolve the neon query
    resolver(mockVkResponse);

    const [r1, r2, p3Result] = await Promise.all([p1, p2, p3]);

    expect(r1).toEqual({
      provider: 'openai',
      apiKey: rawApiKey,
      rateLimitRpm: 60,
    });
    expect(r2).toBe(r1); // Exactly the same reference or resolved value
    expect(p3Result).toBe(r1);

    // neonQuery should be called only once
    expect(neonQuery).toHaveBeenCalledTimes(1);
  });
});
