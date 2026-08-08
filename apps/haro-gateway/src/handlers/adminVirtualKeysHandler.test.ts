import { listVirtualKeysHandler, createVirtualKeyHandler, deleteVirtualKeyHandler } from './adminVirtualKeysHandler';
import { neonQuery } from '../config/neonClient';
import { kvDel } from '../config/kvCrypto';

jest.mock('../config/neonClient', () => ({
  neonQuery: jest.fn(),
}));

jest.mock('../config/kvCrypto', () => ({
  kvDel: jest.fn(),
}));

const mockEnv = {
  DATABASE_URL: 'postgresql://u:p@ep-test.neon.tech/db',
  KV_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  HARO_CONFIG_CACHE: {},
};

const makeMockContext = (options: {
  env?: any;
  query?: Record<string, string>;
  jsonBody?: any;
  params?: Record<string, string>;
}) => {
  const jsonMock = jest.fn().mockImplementation((data, status = 200) => ({
    _data: data,
    _status: status,
    status,
    json: async () => data,
  }));

  return {
    env: options.env || mockEnv,
    req: {
      query: jest.fn((key: string) => options.query?.[key] || null),
      json: jest.fn(async () => {
        if (options.jsonBody === undefined) throw new Error('No body');
        return options.jsonBody;
      }),
      param: jest.fn((key: string) => options.params?.[key] || null),
    },
    json: jsonMock,
  } as any;
};

describe('adminVirtualKeysHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listVirtualKeysHandler', () => {
    it('queries all keys when company_id is not provided', async () => {
      const mockRows = [{ id: '1', name: 'Test Key' }];
      (neonQuery as jest.Mock).mockResolvedValueOnce(mockRows);

      const c = makeMockContext({});
      const res = await listVirtualKeysHandler(c);

      expect(neonQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY created_at DESC'),
        [],
        mockEnv
      );
      expect(c.json).toHaveBeenCalledWith(mockRows, 200);
    });

    it('queries filtered keys when company_id is provided', async () => {
      const companyId = '754f7623-bc9a-4c28-9271-e0c90c749961';
      const mockRows = [{ id: '1', name: 'Test Key', company_id: companyId }];
      (neonQuery as jest.Mock).mockResolvedValueOnce(mockRows);

      const c = makeMockContext({ query: { company_id: companyId } });
      await listVirtualKeysHandler(c);

      expect(neonQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE company_id = $1'),
        [companyId],
        mockEnv
      );
      expect(c.json).toHaveBeenCalledWith(mockRows, 200);
    });

    it('returns 500 on database query failure', async () => {
      (neonQuery as jest.Mock).mockRejectedValueOnce(new Error('Connection lost'));

      const c = makeMockContext({});
      await listVirtualKeysHandler(c);

      expect(c.json).toHaveBeenCalledWith({ error: 'Connection lost' }, 500);
    });
  });

  describe('createVirtualKeyHandler', () => {
    it('returns 400 on invalid JSON body', async () => {
      const c = makeMockContext({}); // No jsonBody configured, throws "No body"
      await createVirtualKeyHandler(c);
      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid JSON body' }, 400);
    });

    it('returns 400 on missing required fields', async () => {
      const c = makeMockContext({
        jsonBody: {
          company_id: '754f7623-bc9a-4c28-9271-e0c90c749961',
          name: 'Missing fields',
          // provider and apiKey missing
        },
      });
      await createVirtualKeyHandler(c);
      expect(c.json).toHaveBeenCalledWith(
        { error: 'Required: company_id, name, provider, apiKey' },
        400
      );
    });

    it('creates, encrypts and secure-masks a long API key (> 8 chars)', async () => {
      const companyId = '754f7623-bc9a-4c28-9271-e0c90c749961';
      const rawApiKey = 'sk-proj-long-secret-key-12345';
      const c = makeMockContext({
        jsonBody: {
          company_id: companyId,
          name: 'Production OpenAI Key',
          provider: 'openai',
          apiKey: rawApiKey,
          rate_limit_rpm: 120,
        },
      });

      (neonQuery as jest.Mock).mockResolvedValueOnce([]);

      await createVirtualKeyHandler(c);

      expect(neonQuery).toHaveBeenCalledTimes(1);
      const queryCallArgs = (neonQuery as jest.Mock).mock.calls[0];
      const queryStr = queryCallArgs[0];
      const queryParams = queryCallArgs[1];

      expect(queryStr).toContain('INSERT INTO public.gateway_virtual_keys');
      expect(queryParams[0]).toBe(companyId); // company_id
      expect(queryParams[1]).toBe(companyId); // created_by defaults to company_id
      expect(queryParams[2]).toBe('Production OpenAI Key'); // name
      expect(queryParams[3]).toMatch(/^vk_[0-9a-f]{8}$/); // slug
      expect(queryParams[4]).toBe('openai'); // provider
      expect(queryParams[5]).not.toBe(rawApiKey); // encrypted key (not plain)
      expect(queryParams[5].length).toBeGreaterThan(20); // base64 combined IV + ciphertext
      expect(queryParams[6]).toBe('...2345'); // masked key (last 4 chars)
      expect(queryParams[7]).toBe(120); // rate_limit_rpm

      expect(c.json).toHaveBeenCalledWith(
        {
          slug: queryParams[3],
          masked_key: '...2345',
          provider: 'openai',
        },
        201
      );
    });

    it('creates and secure-masks a short API key (<= 8 chars)', async () => {
      const companyId = '754f7623-bc9a-4c28-9271-e0c90c749961';
      const rawApiKey = 'short1';
      const c = makeMockContext({
        jsonBody: {
          company_id: companyId,
          name: 'Short Key',
          provider: 'anthropic',
          apiKey: rawApiKey,
        },
      });

      (neonQuery as jest.Mock).mockResolvedValueOnce([]);

      await createVirtualKeyHandler(c);

      const queryParams = (neonQuery as jest.Mock).mock.calls[0][1];
      expect(queryParams[6]).toBe('...t1'); // masked key (last 2 chars)
    });

    it('returns 500 on insertion error', async () => {
      (neonQuery as jest.Mock).mockRejectedValueOnce(new Error('DB constraint violated'));

      const c = makeMockContext({
        jsonBody: {
          company_id: '754f7623-bc9a-4c28-9271-e0c90c749961',
          name: 'OpenAI',
          provider: 'openai',
          apiKey: 'some-api-key',
        },
      });

      await createVirtualKeyHandler(c);
      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Failed to create virtual key: DB constraint violated'),
        }),
        500
      );
    });
  });

  describe('deleteVirtualKeyHandler', () => {
    it('updates active to false and purges cache', async () => {
      (neonQuery as jest.Mock).mockResolvedValueOnce([]);
      (kvDel as jest.Mock).mockResolvedValueOnce(undefined);

      const slug = 'vk_12345678';
      const c = makeMockContext({ params: { slug } });

      await deleteVirtualKeyHandler(c);

      expect(neonQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.gateway_virtual_keys SET is_active = false'),
        [slug],
        mockEnv
      );
      expect(kvDel).toHaveBeenCalledWith(`vk:${slug}`, mockEnv);
      expect(c.json).toHaveBeenCalledWith({ deactivated: true });
    });

    it('returns 500 on db update failure', async () => {
      (neonQuery as jest.Mock).mockRejectedValueOnce(new Error('Failed to update row'));

      const c = makeMockContext({ params: { slug: 'vk_123' } });
      await deleteVirtualKeyHandler(c);

      expect(c.json).toHaveBeenCalledWith({ error: 'Failed to update row' }, 500);
    });
  });
});
