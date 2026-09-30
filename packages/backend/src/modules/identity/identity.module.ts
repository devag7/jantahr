import { Global, Module } from '@nestjs/common';
import { AccountDirectory } from './account-directory.service';
import { IdentityService } from './identity.service';

@Global()
@Module({ providers: [IdentityService, AccountDirectory], exports: [IdentityService, AccountDirectory] })
export class IdentityModule {}
