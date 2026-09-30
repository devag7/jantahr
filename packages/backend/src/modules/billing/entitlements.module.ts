import { Global, Module } from '@nestjs/common';
import { EntitlementsService } from './entitlements.service';

@Global()
@Module({ providers: [EntitlementsService], exports: [EntitlementsService] })
export class EntitlementsModule {}
