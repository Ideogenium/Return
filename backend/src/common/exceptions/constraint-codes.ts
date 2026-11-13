// =============================================================================
// class-validator constraint name → OpenAPI-compatible error code mapping
// =============================================================================
export const CONSTRAINT_CODE_MAP: Record<string, string> = {
  isEmail: 'INVALID_EMAIL',
  // FIX-22: the reserved domain of deleted accounts is reported as an invalid address.
  isNotReservedEmail: 'INVALID_EMAIL',
  isNotEmpty: 'REQUIRED',
  isString: 'INVALID_TYPE',
  isInt: 'INVALID_TYPE',
  isNumber: 'INVALID_TYPE',
  isBoolean: 'INVALID_TYPE',
  isEnum: 'INVALID_ENUM',
  isIn: 'INVALID_ENUM',
  isUuid: 'INVALID_UUID',
  minLength: 'TOO_SHORT',
  maxLength: 'TOO_LONG',
  min: 'TOO_SMALL',
  max: 'TOO_LARGE',
  matches: 'INVALID_FORMAT',
  equals: 'INVALID_VALUE',
  isOptional: 'VALIDATION_ERROR',
  whitelistValidation: 'UNKNOWN_FIELD',
};

export function constraintToCode(constraintName: string): string {
  return CONSTRAINT_CODE_MAP[constraintName] ?? 'VALIDATION_ERROR';
}
