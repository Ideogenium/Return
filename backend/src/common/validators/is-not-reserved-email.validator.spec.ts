import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterDto } from '../../auth/dto/register.dto.js';
import { UpdateUserDto } from '../../users/dto/update-user.dto.js';
import { constraintToCode } from '../exceptions/constraint-codes.js';
import { RESERVED_EMAIL_DOMAIN } from './is-not-reserved-email.validator.js';

// FIX-22 security review (B1): a tombstone address lives on the reserved `deleted.invalid` domain.
// If anyone could take such an address first, deleting the matching account would hit the unique
// email constraint forever. Nobody may set an address on that domain.

const VALID_REGISTER = {
  email: 'john@example.com',
  password: 'StrongPass1!',
  firstName: 'John',
  lastName: 'Doe',
};

async function errorsOn(dto: object) {
  return (await validate(dto)).find((error) => error.property === 'email');
}

describe('reserved email domain (deleted.invalid)', () => {
  it.each([
    'deleted+550e8400-e29b-41d4-a716-446655440000@deleted.invalid',
    'someone@DELETED.INVALID',
    'someone@Deleted.Invalid',
  ])('is refused at registration (%s)', async (email) => {
    const error = await errorsOn(plainToInstance(RegisterDto, { ...VALID_REGISTER, email }));

    expect(error?.constraints).toHaveProperty('isNotReservedEmail');
    expect(constraintToCode('isNotReservedEmail')).toBe('INVALID_EMAIL');
  });

  it('is refused when changing the profile email', async () => {
    const error = await errorsOn(
      plainToInstance(UpdateUserDto, { email: 'deleted+x@deleted.invalid' }),
    );

    expect(error?.constraints).toHaveProperty('isNotReservedEmail');
  });

  it.each(['john@example.com', 'john@notdeleted.invalid', 'john@deleted.invalid.example.com'])(
    'leaves other addresses alone (%s)',
    async (email) => {
      const error = await errorsOn(plainToInstance(RegisterDto, { ...VALID_REGISTER, email }));

      expect(error?.constraints?.['isNotReservedEmail']).toBeUndefined();
    },
  );

  it('names the domain once', () => {
    expect(RESERVED_EMAIL_DOMAIN).toBe('deleted.invalid');
  });
});
