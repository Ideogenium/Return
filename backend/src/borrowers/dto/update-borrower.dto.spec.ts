import { ValidationPipe, BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';

import { UpdateBorrowerDto } from './update-borrower.dto.js';

describe('UpdateBorrowerDto validation', () => {
  // Mirrors the global ValidationPipe configuration (see main.ts).
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const meta: ArgumentMetadata = { type: 'body', metatype: UpdateBorrowerDto, data: '' };

  it('rejects any attempt to modify the email (FIX-09)', async () => {
    // email is the invitation identifier — it must never be editable.
    await expect(pipe.transform({ email: 'new.email@example.com' }, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts updating the local alias fields (firstName / lastName)', async () => {
    const dto = (await pipe.transform(
      { firstName: 'Marie-Claire', lastName: 'Dupont' },
      meta,
    )) as UpdateBorrowerDto;

    expect(dto.firstName).toBe('Marie-Claire');
    expect(dto.lastName).toBe('Dupont');
  });
});
