import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller.js';

@Module({ controllers: [PrivacyController] })
export class LegalModule {}
