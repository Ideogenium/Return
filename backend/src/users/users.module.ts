import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { AccountDeletionService } from './account-deletion.service.js';
import { PhotoStorageModule } from '../storage/photo-storage.module.js';
import { TrustScoreModule } from '../trust-score/trust-score.module.js';

@Module({
  imports: [PhotoStorageModule, TrustScoreModule],
  controllers: [UsersController],
  providers: [UsersService, AccountDeletionService],
  exports: [UsersService],
})
export class UsersModule {}
