import { ValidationPipe, BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';

import { CreateLoanDto } from './create-loan.dto.js';

describe('CreateLoanDto validation', () => {
  // Mirrors the global ValidationPipe configuration (see main.ts).
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });
  const meta: ArgumentMetadata = { type: 'body', metatype: CreateLoanDto, data: '' };
  const UUID = '11111111-1111-4111-8111-111111111111';

  it('rejects a loan without a returnDate (FIX-03)', async () => {
    await expect(pipe.transform({ item: UUID, borrowerId: UUID }, meta)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('accepts a loan with a valid returnDate', async () => {
    const dto = (await pipe.transform(
      { item: UUID, borrowerId: UUID, returnDate: '2099-06-01' },
      meta,
    )) as CreateLoanDto;

    expect(dto.returnDate).toBe('2099-06-01');
  });
});
