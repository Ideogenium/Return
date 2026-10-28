import { Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import type { S3Client } from '@aws-sdk/client-s3';

import { R2PhotoStorageService, createR2Client } from './r2-photo-storage.service.js';
import type { R2Settings } from '../config/r2-settings.js';

describe('R2PhotoStorageService', () => {
  const SETTINGS: R2Settings = {
    accountId: '0123456789abcdef0123456789abcdef',
    accessKeyId: 'access-key',
    secretAccessKey: 'secret-key',
    bucketName: 'return-photos',
    publicUrl: 'https://photos.example.r2.dev',
  };

  let send: jest.Mock;
  let service: R2PhotoStorageService;
  let errorLog: jest.SpyInstance;

  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']));

  beforeEach(() => {
    send = jest.fn().mockResolvedValue({});
    errorLog = jest.spyOn(Logger.prototype, 'error');
    service = new R2PhotoStorageService(
      { bucketName: SETTINGS.bucketName, publicUrl: SETTINGS.publicUrl },
      { send } as unknown as Pick<S3Client, 'send'>,
    );
  });

  afterEach(() => errorLog.mockRestore());

  const sentCommand = (): unknown => send.mock.calls[0][0];

  describe('upload', () => {
    it('puts the object in the bucket under the given key and returns its public URL', async () => {
      const file = Buffer.from('fake-image');

      const result = await service.upload(file, 'items/item-1/photo.jpg');

      expect(result).toEqual({
        key: 'items/item-1/photo.jpg',
        url: 'https://photos.example.r2.dev/items/item-1/photo.jpg',
        thumbnailUrl: null,
      });
      const command = sentCommand();
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect((command as PutObjectCommand).input).toMatchObject({
        Bucket: 'return-photos',
        Key: 'items/item-1/photo.jpg',
        Body: file,
      });
    });

    it.each([
      ['photo.jpg', 'image/jpeg'],
      ['photo.jpeg', 'image/jpeg'],
      ['photo.png', 'image/png'],
      ['photo.PNG', 'image/png'],
    ])('sets the content type from the key extension (%s → %s)', async (key, contentType) => {
      await service.upload(Buffer.from('img'), `items/item-1/${key}`);

      expect((sentCommand() as PutObjectCommand).input.ContentType).toBe(contentType);
    });

    it('lets clients cache forever (fresh key per upload) but keeps CDN edges short so deletions take effect', async () => {
      await service.upload(Buffer.from('img'), 'items/item-1/photo.jpg');

      expect((sentCommand() as PutObjectCommand).input.CacheControl).toBe(
        'public, max-age=31536000, s-maxage=86400, immutable',
      );
    });

    it('propagates storage failures so the caller never records a photo that was not stored', async () => {
      send.mockRejectedValue(new Error('R2 unavailable'));

      await expect(service.upload(Buffer.from('img'), 'items/item-1/photo.jpg')).rejects.toThrow(
        'R2 unavailable',
      );
    });

    it('logs a storage failure with the operation and the key', async () => {
      send.mockRejectedValue(Object.assign(new Error('Access Denied'), { name: 'AccessDenied' }));

      await expect(service.upload(Buffer.from('img'), 'items/item-1/photo.jpg')).rejects.toThrow();

      expect(errorLog).toHaveBeenCalledWith(
        expect.stringMatching(/upload.*items\/item-1\/photo\.jpg.*AccessDenied/),
      );
    });
  });

  describe('delete', () => {
    it('deletes the object by key', async () => {
      await service.delete('items/item-1/photo.jpg');

      const command = sentCommand();
      expect(command).toBeInstanceOf(DeleteObjectCommand);
      expect((command as DeleteObjectCommand).input).toEqual({
        Bucket: 'return-photos',
        Key: 'items/item-1/photo.jpg',
      });
    });

    it('resolves the key from a public URL of this bucket (URLs are what the database stores)', async () => {
      await service.delete('https://photos.example.r2.dev/users/user-1/avatar-abc.png');

      expect((sentCommand() as DeleteObjectCommand).input.Key).toBe('users/user-1/avatar-abc.png');
    });

    it('ignores URLs that do not belong to this bucket (legacy local-disk photos) instead of deleting a wrong key', async () => {
      await service.delete('https://return-api.fly.dev/uploads/items/item-1/photo.jpg');

      expect(send).not.toHaveBeenCalled();
    });

    it('propagates storage failures', async () => {
      send.mockRejectedValue(new Error('R2 unavailable'));

      await expect(service.delete('items/item-1/photo.jpg')).rejects.toThrow('R2 unavailable');
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringMatching(/delete.*items\/item-1\/photo\.jpg/),
      );
    });
  });

  describe('deleteByPrefix', () => {
    const keysPage = (count: number, offset = 0) =>
      Array.from({ length: count }, (_, i) => ({ Key: `users/user-1/items/i/${offset + i}.jpg` }));

    it('deletes every object listed under the prefix and returns how many were deleted', async () => {
      send.mockImplementation((command: unknown) =>
        Promise.resolve(
          command instanceof ListObjectsV2Command
            ? { Contents: keysPage(3), IsTruncated: false }
            : { Errors: [] },
        ),
      );

      await expect(service.deleteByPrefix('users/user-1/')).resolves.toBe(3);

      const list = send.mock.calls[0][0] as ListObjectsV2Command;
      expect(list).toBeInstanceOf(ListObjectsV2Command);
      expect(list.input).toMatchObject({ Bucket: 'return-photos', Prefix: 'users/user-1/' });
      const del = send.mock.calls[1][0] as DeleteObjectsCommand;
      expect(del).toBeInstanceOf(DeleteObjectsCommand);
      expect(del.input.Bucket).toBe('return-photos');
      expect(del.input.Delete?.Objects).toEqual(keysPage(3));
    });

    it('is idempotent: nothing listed means nothing deleted', async () => {
      send.mockResolvedValue({ IsTruncated: false });

      await expect(service.deleteByPrefix('users/user-1/')).resolves.toBe(0);
      expect(send).toHaveBeenCalledTimes(1);
    });

    it('follows the listing pagination and deletes each page (at most 1000 keys per request)', async () => {
      const pages = [
        { Contents: keysPage(1000), IsTruncated: true, NextContinuationToken: 'next-1' },
        { Contents: keysPage(250, 1000), IsTruncated: false },
      ];
      let listCall = 0;
      send.mockImplementation((command: unknown) =>
        Promise.resolve(
          command instanceof ListObjectsV2Command ? pages[listCall++] : { Errors: [] },
        ),
      );

      await expect(service.deleteByPrefix('users/user-1/')).resolves.toBe(1250);

      const lists = send.mock.calls
        .map(([c]) => c)
        .filter((c): c is ListObjectsV2Command => c instanceof ListObjectsV2Command);
      expect(lists[1].input.ContinuationToken).toBe('next-1');
      const deletes = send.mock.calls
        .map(([c]) => c)
        .filter((c): c is DeleteObjectsCommand => c instanceof DeleteObjectsCommand);
      expect(deletes.map((d) => d.input.Delete?.Objects?.length)).toEqual([1000, 250]);
    });

    it('fails, logged, when R2 reports per-object deletion errors', async () => {
      send.mockImplementation((command: unknown) =>
        Promise.resolve(
          command instanceof ListObjectsV2Command
            ? { Contents: keysPage(2), IsTruncated: false }
            : { Errors: [{ Key: 'users/user-1/items/i/0.jpg', Code: 'AccessDenied' }] },
        ),
      );

      await expect(service.deleteByPrefix('users/user-1/')).rejects.toThrow();
      expect(errorLog).toHaveBeenCalledWith(expect.stringMatching(/users\/user-1\//));
    });

    it('propagates and logs a storage failure', async () => {
      send.mockRejectedValue(
        Object.assign(new Error('R2 unavailable'), { name: 'ServiceUnavailable' }),
      );

      await expect(service.deleteByPrefix('users/user-1/')).rejects.toThrow('R2 unavailable');
      expect(errorLog).toHaveBeenCalledWith(
        expect.stringMatching(/purge.*users\/user-1\/.*ServiceUnavailable/),
      );
    });

    it.each(['', '/', 'users', 'users/../', 'users/user-1'])(
      'refuses a prefix that could reach beyond one folder, without calling R2 (%p)',
      async (prefix) => {
        await expect(service.deleteByPrefix(prefix)).rejects.toThrow(/prefix/i);
        expect(send).not.toHaveBeenCalled();
      },
    );
  });

  describe('createR2Client', () => {
    it('targets the account R2 S3 endpoint in the "auto" region', async () => {
      const client = createR2Client(SETTINGS);

      const endpoint = await client.config.endpoint?.();
      await expect(client.config.region()).resolves.toBe('auto');
      expect(endpoint?.hostname).toBe('0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com');
      expect(endpoint?.protocol).toBe('https:');
    });

    it('bounds retries so a slow R2 cannot hold upload requests indefinitely', async () => {
      const client = createR2Client(SETTINGS);

      await expect(client.config.maxAttempts()).resolves.toBe(3);
    });

    it('only computes checksums when required, as Cloudflare recommends for R2', async () => {
      const client = createR2Client(SETTINGS);

      await expect(client.config.requestChecksumCalculation()).resolves.toBe('WHEN_REQUIRED');
      await expect(client.config.responseChecksumValidation()).resolves.toBe('WHEN_REQUIRED');
    });
  });

  describe('getUrl', () => {
    it('returns the public URL of the key', async () => {
      await expect(service.getUrl('items/item-1/photo.jpg')).resolves.toBe(
        'https://photos.example.r2.dev/items/item-1/photo.jpg',
      );
    });
  });
});
