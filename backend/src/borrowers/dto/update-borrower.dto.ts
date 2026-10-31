import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * DTO for updating a borrower.
 *
 * FIX-09: `email` is intentionally absent. A borrower's email is the identifier
 * used to link contacts to registered users (invitations) — it must never be
 * editable. With the global ValidationPipe (forbidNonWhitelisted: true), any
 * PATCH body containing `email` is rejected with 400. firstName / lastName are
 * local aliases, owned by the lender, and remain editable.
 */
export class UpdateBorrowerDto {
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
  @IsString()
  phoneNumber?: string | null;
}
