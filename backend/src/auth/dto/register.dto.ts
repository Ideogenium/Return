import { IsNotReservedEmail } from '../../common/validators/is-not-reserved-email.validator.js';
import { IsEmail, IsString, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * DTO pour l'inscription d'un nouvel utilisateur.
 *
 * Validation conforme à l'OpenAPI RegisterDto :
 * - email : format email valide
 * - password : 8-100 chars, 1 majuscule, 1 minuscule, 1 chiffre, 1 spécial
 * - firstName / lastName : 1-50 chars
 */
export class RegisterDto {
  @IsEmail()
  @IsNotReservedEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/, {
    message:
      'Password must contain at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character (@$!%*?&). Only letters, digits, and @$!%*?& are allowed.',
  })
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName!: string;
}
