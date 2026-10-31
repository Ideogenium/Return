import { Module } from '@nestjs/common';

import { TrustScoreService } from './trust-score.service.js';

/**
 * FIX-15: shared trust-score computation. PrismaModule is global, so this module
 * only needs to provide and export the service. Imported by UsersModule (self
 * profile) and BorrowersModule (contact sheet).
 */
@Module({
  providers: [TrustScoreService],
  exports: [TrustScoreService],
})
export class TrustScoreModule {}
