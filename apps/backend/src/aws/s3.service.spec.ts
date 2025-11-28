import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import { S3Service, FileCategory } from './s3.service';
import { AppConfigService } from '../config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Mock AWS SDK
jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

interface MockS3Client {
  send: jest.Mock;
}

describe('S3Service', () => {
  let service: S3Service;
  let s3ClientMock: MockS3Client;

  const mockConfigService = {
    awsS3Bucket: 'test-bucket',
    awsRegion: 'il-central-1',
    awsAccessKeyId: 'test-key',
    awsSecretAccessKey: 'test-secret',
    awsCloudfrontUrl: 'https://cdn.example.com',
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    s3ClientMock = {
      send: jest.fn(),
    };
    (S3Client as jest.Mock).mockImplementation(() => s3ClientMock);
    (getSignedUrl as jest.Mock).mockResolvedValue('https://signed-url.com');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
    service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('initialization', () => {
    it('should initialize S3 client with config', () => {
      expect(S3Client).toHaveBeenCalledWith({
        region: 'il-central-1',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      });
    });
  });

  describe('upload', () => {
    it('should upload file and return key and url', async () => {
      const options = {
        key: 'test-key.jpg',
        body: Buffer.from('test'),
        contentType: 'image/jpeg',
      };

      s3ClientMock.send.mockResolvedValue({});

      const result = await service.upload(options);

      expect(result).toEqual({
        key: 'test-key.jpg',
        url: 'https://cdn.example.com/test-key.jpg',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'test-bucket',
          Key: 'test-key.jpg',
          Body: options.body,
          ContentType: 'image/jpeg',
        })
      );
      expect(s3ClientMock.send).toHaveBeenCalled();
    });
  });

  describe('getUploadUrl', () => {
    it('should generate presigned upload URL', async () => {
      const options = {
        key: 'test-upload.jpg',
        contentType: 'image/jpeg',
        expiresIn: 3600,
      };

      const result = await service.getUploadUrl(options);

      expect(result).toEqual({
        uploadUrl: 'https://signed-url.com',
        key: 'test-upload.jpg',
      });

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'test-upload.jpg',
        ContentType: 'image/jpeg',
      });
      expect(getSignedUrl).toHaveBeenCalled();
    });
  });

  describe('generateKey', () => {
    it('should generate correct key format', () => {
      const key = service.generateKey(FileCategory.IMAGES, 'my-image.jpg', 'user-123');
      expect(key).toMatch(/^images\/user-123\/\d+-my-image\.jpg$/);
    });

    it('should generate key without user id', () => {
      const key = service.generateKey(FileCategory.AVATARS, 'avatar.png');
      expect(key).toMatch(/^avatars\/\d+-avatar\.png$/);
    });
  });
});
