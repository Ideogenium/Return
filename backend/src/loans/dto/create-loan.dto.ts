import { IsOptional, IsString, MaxLength, IsDateString, IsUUID, IsNotEmpty } from 'class-validator';
import { CreateItemDto } from '../../items/dto/create-item.dto.js';
import { IsUuidOrDto } from '../../common/validators/is-uuid-or-dto.validator.js';

/**
 * DTO for creating a loan.
 *
 * Per OpenAPI spec (RÈGLE DE DIAMANT):
 * - `item` can be either a UUID string or an inline CreateItemDto object
 * - `borrowerId` MUST be a UUID string referencing an existing Borrower (CINV-019)
 *
 * Since Sprint 4.6, inline borrower creation is deprecated. Borrowers are
 * created automatically when a contact invitation is accepted.
 */
export class CreateLoanDto {
  @IsUuidOrDto(CreateItemDto)
  item!: string | CreateItemDto;

  @IsUUID()
  borrowerId!: string;

  // FIX-03: returnDate is mandatory — the reminder policy relies on it.
  // A loan without a due date can never trigger reminders (the core promise).
  @IsNotEmpty()
  @IsDateString()
  returnDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
