import { Global, Module } from '@nestjs/common';
import { ConsentService } from './consent/consent.service';
import { CryptoService } from './crypto/crypto.service';
import { AccessService } from './access/access.service';
import { StorageService } from './storage/storage.service';
import { UploadsController } from './storage/uploads.controller';

@Global()
@Module({
  controllers: [UploadsController],
  providers: [CryptoService, AccessService, StorageService, ConsentService],
  exports: [CryptoService, AccessService, StorageService, ConsentService],
})
export class CommonModule {}
