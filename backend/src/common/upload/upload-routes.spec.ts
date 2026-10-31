import { INestApplication, ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ItemsController } from '../../items/items.controller.js';
import { ItemsService } from '../../items/items.service.js';
import { UsersController } from '../../users/users.controller.js';
import { UsersService } from '../../users/users.service.js';
import { TrustScoreService } from '../../trust-score/trust-score.service.js';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard.js';
import { AllExceptionsFilter } from '../exceptions/all-exceptions.filter.js';
import type { ProblemDetails } from '../exceptions/problem-details.exception.js';

// =============================================================================
// Upload routes — real Multer, real ParseFilePipe, real AllExceptionsFilter
// =============================================================================
// Proves end to end that an oversized upload is cut by Multer itself (message
// "File too large", nothing buffered beyond the limit) and answered with the
// contract's 400, and that every other upload error gets its own error code.
// =============================================================================

jest.mock('../middleware/request-context.middleware.js', () => ({
  getRequestId: () => 'test-request-id',
}));

// FileTypeValidator loads the ESM package `file-type` through a dynamic import, which Jest's
// CommonJS runtime cannot do (the validator then refuses every file). In production it works;
// here a minimal JPEG signature detector stands in for it, the wiring under test is unchanged.
jest.mock('load-esm', () => ({
  loadEsm: () =>
    Promise.resolve({
      fileTypeFromBuffer: (buffer: Buffer) =>
        Promise.resolve(
          buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
            ? { ext: 'jpg', mime: 'image/jpeg' }
            : undefined,
        ),
    }),
}));

const MB = 1024 * 1024;
const ITEM_ID = '9a1b2c3d-4e5f-4a7b-8c9d-0e1f2a3b4c5d';
const JPEG = { filename: 'photo.jpg', contentType: 'image/jpeg' };

/** A buffer of `size` bytes that starts with a JPEG signature: the type check reads magic numbers. */
function jpeg(size: number): Buffer {
  const buffer = Buffer.alloc(size);
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]).copy(
    buffer,
  );
  return buffer;
}

describe('Upload routes (Multer limits and error codes)', () => {
  let app: INestApplication;
  const itemsService = { addPhoto: jest.fn() };
  const usersService = { updateAvatar: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ItemsController, UsersController],
      providers: [
        { provide: ItemsService, useValue: itemsService },
        { provide: UsersService, useValue: usersService },
        { provide: TrustScoreService, useValue: {} },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = { userId: 'user-1' };
          return true;
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    itemsService.addPhoto.mockResolvedValue({ id: 'photo-1', url: 'https://r2/photo.jpg' });
    usersService.updateAvatar.mockResolvedValue({ profilePicture: 'https://r2/avatar.jpg' });
  });

  function firstError(body: unknown) {
    return (body as ProblemDetails).errors![0];
  }

  describe('POST /items/:itemId/photos (5 MB)', () => {
    const url = `/items/${ITEM_ID}/photos`;

    it('accepts a JPEG under the limit', async () => {
      const res = await request(app.getHttpServer())
        .post(url)
        .attach('photo', jpeg(1 * MB), JPEG);

      expect(res.status).toBe(201);
      expect(itemsService.addPhoto).toHaveBeenCalledTimes(1);
    });

    it('cuts a file over 5 MB in Multer and answers 400 TOO_LARGE', async () => {
      const res = await request(app.getHttpServer())
        .post(url)
        .attach('photo', jpeg(6 * MB), JPEG);

      expect(res.status).toBe(400);
      expect(res.headers['content-type']).toContain('application/problem+json');
      // "File too large" is Multer's own message: the limit stopped the upload stream.
      expect(firstError(res.body)).toEqual({
        field: 'file',
        code: 'TOO_LARGE',
        message: 'File too large',
      });
      expect(itemsService.addPhoto).not.toHaveBeenCalled();
    });

    it('answers 400 FILE_REQUIRED for a refused type', async () => {
      const res = await request(app.getHttpServer())
        .post(url)
        .attach('photo', Buffer.alloc(1024), { filename: 'anim.gif', contentType: 'image/gif' });

      expect(res.status).toBe(400);
      expect(firstError(res.body)).toMatchObject({ field: 'file', code: 'FILE_REQUIRED' });
      expect(itemsService.addPhoto).not.toHaveBeenCalled();
    });

    it('answers 400 FILE_REQUIRED without a file', async () => {
      const res = await request(app.getHttpServer()).post(url).field('note', 'no file');

      expect(res.status).toBe(400);
      expect(firstError(res.body)).toMatchObject({ field: 'file', code: 'FILE_REQUIRED' });
    });

    it('refuses a second file with a 400 VALIDATION_ERROR on the file field', async () => {
      const res = await request(app.getHttpServer())
        .post(url)
        .attach('photo', jpeg(1024), JPEG)
        .attach('photo', jpeg(1024), JPEG);

      expect(res.status).toBe(400);
      expect(firstError(res.body)).toMatchObject({ field: 'file', code: 'VALIDATION_ERROR' });
      expect(itemsService.addPhoto).not.toHaveBeenCalled();
    });

    it('refuses a flood of text fields with a 400 VALIDATION_ERROR on the file field', async () => {
      let req = request(app.getHttpServer()).post(url);
      for (let i = 0; i < 20; i += 1) req = req.field(`f${i}`, 'x');
      const res = await req.attach('photo', jpeg(1024), JPEG);

      expect(res.status).toBe(400);
      expect(firstError(res.body)).toMatchObject({ field: 'file', code: 'VALIDATION_ERROR' });
      expect(itemsService.addPhoto).not.toHaveBeenCalled();
    });

    it('refuses an oversized text field with a 400 VALIDATION_ERROR on the file field', async () => {
      const res = await request(app.getHttpServer())
        .post(url)
        .field('note', 'x'.repeat(10_000))
        .attach('photo', jpeg(1024), JPEG);

      expect(res.status).toBe(400);
      expect(firstError(res.body)).toMatchObject({ field: 'file', code: 'VALIDATION_ERROR' });
    });

    it('answers 400 INVALID_UUID on id for a malformed item id', async () => {
      const res = await request(app.getHttpServer())
        .post('/items/not-a-uuid/photos')
        .attach('photo', jpeg(1024), JPEG);

      expect(res.status).toBe(400);
      expect(firstError(res.body)).toMatchObject({ field: 'id', code: 'INVALID_UUID' });
    });
  });

  describe('PUT /users/me/avatar (2 MB)', () => {
    it('accepts a JPEG under the limit', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/me/avatar')
        .attach('avatar', jpeg(1 * MB), JPEG);

      expect(res.status).toBe(200);
      expect(usersService.updateAvatar).toHaveBeenCalledTimes(1);
    });

    it('cuts a file over 2 MB in Multer and answers 400 TOO_LARGE', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/me/avatar')
        .attach('avatar', jpeg(3 * MB), JPEG);

      expect(res.status).toBe(400);
      expect(firstError(res.body)).toEqual({
        field: 'file',
        code: 'TOO_LARGE',
        message: 'File too large',
      });
      expect(usersService.updateAvatar).not.toHaveBeenCalled();
    });

    it('answers 400 FILE_REQUIRED for a refused type', async () => {
      const res = await request(app.getHttpServer())
        .put('/users/me/avatar')
        .attach('avatar', Buffer.alloc(1024), { filename: 'anim.gif', contentType: 'image/gif' });

      expect(res.status).toBe(400);
      expect(firstError(res.body)).toMatchObject({ field: 'file', code: 'FILE_REQUIRED' });
    });
  });
});
