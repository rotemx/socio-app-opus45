import { api } from './api';

// Mock fetch
global.fetch = jest.fn();

describe('ApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset env vars if needed
  });

  it('should construct correct URL with params', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { id: 1 } }),
    });

    await api.get('/test', { params: { foo: 'bar' } });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/test?foo=bar'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('should include auth token if set', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: [] }),
    });

    api.setAccessToken('fake-token');
    await api.get('/protected');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-token',
        }),
      })
    );
  });
});
