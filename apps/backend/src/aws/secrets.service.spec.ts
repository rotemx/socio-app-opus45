import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { SecretsService } from './secrets.service';
import { AppConfigService } from '../config';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager');

interface MockSecretsClient {
  send: jest.Mock;
}

describe('SecretsService', () => {
  let service: SecretsService;
  let secretsClientMock: MockSecretsClient;

  const mockConfigService = {
    awsRegion: 'il-central-1',
    awsAccessKeyId: 'test-key',
    awsSecretAccessKey: 'test-secret',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    secretsClientMock = {
      send: jest.fn(),
    };
    (SecretsManagerClient as jest.Mock).mockImplementation(() => secretsClientMock);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecretsService,
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<SecretsService>(SecretsService);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSecret', () => {
    it('should return parsed secret value', async () => {
      const secretValue = { username: 'admin', password: 'password' };
      secretsClientMock.send.mockResolvedValue({
        SecretString: JSON.stringify(secretValue),
      });

      const result = await service.getSecret('test-secret');

      expect(result).toEqual(secretValue);
      expect(GetSecretValueCommand).toHaveBeenCalledWith({
        SecretId: 'test-secret',
      });
    });

    it('should return cached value on second call', async () => {
      const secretValue = { key: 'value' };
      secretsClientMock.send.mockResolvedValue({
        SecretString: JSON.stringify(secretValue),
      });

      // First call
      await service.getSecret('cached-secret');
      
      // Second call
      const result = await service.getSecret('cached-secret');

      expect(result).toEqual(secretValue);
      expect(secretsClientMock.send).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle non-JSON string secrets', async () => {
      secretsClientMock.send.mockResolvedValue({
        SecretString: 'plain-text-secret',
      });

      const result = await service.getSecret('string-secret');

      expect(result).toEqual({ value: 'plain-text-secret' });
    });
  });

  describe('getDatabaseCredentials', () => {
    it('should parse database credentials correctly', async () => {
      const dbSecret = {
        username: 'dbuser',
        password: 'dbpass',
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
      };

      secretsClientMock.send.mockResolvedValue({
        SecretString: JSON.stringify(dbSecret),
      });

      const result = await service.getDatabaseCredentials('db-secret');

      expect(result).toEqual({
        url: 'postgresql://dbuser:dbpass@db.example.com:5432/mydb',
        host: 'db.example.com',
        port: 5432,
        database: 'mydb',
        username: 'dbuser',
      });
    });
  });
});
