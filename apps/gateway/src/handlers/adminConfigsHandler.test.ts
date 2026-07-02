import { listConfigsHandler, createConfigHandler, deleteConfigHandler } from './adminConfigsHandler';
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

describe('adminConfigsHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listConfigsHandler', () => {
    it('queries all active configs when company_id is omitted', async () => {
      const mockRows = [{ id: '1', name: 'Standard config' }];
      (neonQuery as jest.Mock).mockResolvedValueOnce(mockRows);

      const c = makeMockContext({});
      await listConfigsHandler(c);

      expect(neonQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE is_active = true ORDER BY created_at DESC'),
        [],
        mockEnv
      );
      expect(c.json).toHaveBeenCalledWith(mockRows, 200);
    });

    it('queries filtered configs when company_id is provided', async () => {
      const companyId = '754f7623-bc9a-4c28-9271-e0c90c749961';
      const mockRows = [{ id: '1', name: 'Custom Config', company_id: companyId }];
      (neonQuery as jest.Mock).mockResolvedValueOnce(mockRows);

      const c = makeMockContext({ query: { company_id: companyId } });
      await listConfigsHandler(c);

      expect(neonQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE company_id = $1 AND is_active = true'),
        [companyId],
        mockEnv
      );
      expect(c.json).toHaveBeenCalledWith(mockRows, 200);
    });

    it('returns 500 on database failure', async () => {
      (neonQuery as jest.Mock).mockRejectedValueOnce(new Error('DB failure'));

      const c = makeMockContext({});
      await listConfigsHandler(c);

      expect(c.json).toHaveBeenCalledWith({ error: 'DB failure' }, 500);
    });
  });

  describe('createConfigHandler', () => {
    it('returns 400 on invalid JSON body', async () => {
      const c = makeMockContext({}); // No jsonBody throws Error
      await createConfigHandler(c);
      expect(c.json).toHaveBeenCalledWith({ error: 'Invalid JSON body' }, 400);
    });

    it('returns 400 with details when Zod validation fails (missing fields)', async () => {
      const c = makeMockContext({
        jsonBody: {
          name: 'Invalid because company_id is missing',
          config: {},
        },
      });

      await createConfigHandler(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.any(Object),
        }),
        400
      );
    });

    it('returns 400 when company_id is not a valid UUID', async () => {
      const c = makeMockContext({
        jsonBody: {
          company_id: 'not-a-uuid',
          name: 'Invalid UUID',
          config: { some: 'value' },
        },
      });

      await createConfigHandler(c);

      expect(c.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Validation failed',
          details: expect.any(Object),
        }),
        400
      );
    });

    it('creates config preset on valid body', async () => {
      const companyId = '754f7623-bc9a-4c28-9271-e0c90c749961';
      const configPreset = {
        strategy: 'fallback',
        providers: ['openai', 'anthropic'],
      };

      const c = makeMockContext({
        jsonBody: {
          company_id: companyId,
          name: 'Fallback Config Preset',
          config: configPreset,
        },
      });

      (neonQuery as jest.Mock).mockResolvedValueOnce([]);

      await createConfigHandler(c);

      expect(neonQuery).toHaveBeenCalledTimes(1);
      const queryCallArgs = (neonQuery as jest.Mock).mock.calls[0];
      const queryStr = queryCallArgs[0];
      const queryParams = queryCallArgs[1];

      expect(queryStr).toContain('INSERT INTO public.gateway_configs');
      expect(queryParams[0]).toBe(companyId); // company_id
      expect(queryParams[1]).toBe(companyId); // created_by defaults to company_id
      expect(queryParams[2]).toBe('Fallback Config Preset'); // name
      expect(queryParams[3]).toMatch(/^cfg_[0-9a-f]{8}$/); // slug
      expect(queryParams[4]).toBe(JSON.stringify(configPreset)); // config json

      expect(c.json).toHaveBeenCalledWith({ slug: queryParams[3] }, 201);
    });

    it('returns 500 on db insert failure', async () => {
      (neonQuery as jest.Mock).mockRejectedValueOnce(new Error('Unique key violation'));

      const c = makeMockContext({
        jsonBody: {
          company_id: '754f7623-bc9a-4c28-9271-e0c90c749961',
          name: 'Unique name',
          config: { x: 1 },
        },
      });

      await createConfigHandler(c);
      expect(c.json).toHaveBeenCalledWith(
        { error: 'Failed to create config preset: Unique key violation' },
        500
      );
    });
  });

  describe('deleteConfigHandler', () => {
    it('sets config is_active to false and invalidates cache', async () => {
      (neonQuery as jest.Mock).mockResolvedValueOnce([]);
      (kvDel as jest.Mock).mockResolvedValueOnce(undefined);

      const slug = 'cfg_12345678';
      const c = makeMockContext({ params: { slug } });

      await deleteConfigHandler(c);

      expect(neonQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE public.gateway_configs SET is_active = false'),
        [slug],
        mockEnv
      );
      expect(kvDel).toHaveBeenCalledWith(`cfg:${slug}`, mockEnv);
      expect(c.json).toHaveBeenCalledWith({ deactivated: true });
    });

    it('returns 500 on db update failure', async () => {
      (neonQuery as jest.Mock).mockRejectedValueOnce(new Error('Connection failed'));

      const c = makeMockContext({ params: { slug: 'cfg_123' } });
      await deleteConfigHandler(c);

      expect(c.json).toHaveBeenCalledWith({ error: 'Connection failed' }, 500);
    });
  });
});
