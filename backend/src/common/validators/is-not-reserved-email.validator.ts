// =============================================================================
// Custom validator: @IsNotReservedEmail()
// The `deleted.invalid` domain (RFC 2606) holds the addresses of deleted accounts kept as
// tombstones (FIX-22, ADR 0010). Nobody may set an address on it: an account holding a
// tombstone address would make the deletion of the matching account fail on the unique
// email constraint. Reported as INVALID_EMAIL (see constraint-codes.ts).
// =============================================================================

import { registerDecorator, type ValidationOptions } from 'class-validator';

export const RESERVED_EMAIL_DOMAIN = 'deleted.invalid';

export function isReservedEmail(value: string): boolean {
  return value.toLowerCase().endsWith(`@${RESERVED_EMAIL_DOMAIN}`);
}

export function IsNotReservedEmail(validationOptions?: ValidationOptions): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isNotReservedEmail',
      target: object.constructor,
      propertyName: propertyName as string,
      options: {
        message: `email must not use the reserved ${RESERVED_EMAIL_DOMAIN} domain`,
        ...validationOptions,
      },
      validator: {
        validate: (value: unknown) => typeof value !== 'string' || !isReservedEmail(value),
      },
    });
  };
}
