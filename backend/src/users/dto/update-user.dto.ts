import { IsNotReservedEmail } from '../../common/validators/is-not-reserved-email.validator.js';
import { IsEmail, IsOptional, IsString, Matches, MinLength, MaxLength } from 'class-validator';

/**
 * DTO pour la mise à jour partielle du profil utilisateur.
 *
 * Tous les champs sont optionnels (PATCH sémantique).
 * Correspond à l'OpenAPI UpdateUserDto :
 * - firstName : 1-50 chars
 * - lastName  : 1-50 chars
 * - email     : format email valide (peut déclencher un 409 si déjà pris)
 */
export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  @IsNotReservedEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  lastName?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'Phone must be in E.164 format (e.g. +33612345678)' })
  phone?: string;
}
