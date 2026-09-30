import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsInt, IsString, MaxLength, Min } from 'class-validator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { AuthUser } from '../types';
import { StorageService, uploadScope } from './storage.service';

export class SignUploadDto {
  @IsString() @MaxLength(200) fileName!: string;
  @IsString() @MaxLength(120) mime!: string;
  @Type(() => Number) @IsInt() @Min(1) size!: number;
}

/** Presigned direct uploads for serverless deployments (see StorageService). */
@Controller('uploads')
export class UploadsController {
  constructor(private storage: StorageService) {}

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('sign')
  sign(@CurrentUser() user: AuthUser, @Body() dto: SignUploadDto) {
    return this.storage.signUpload(uploadScope(user), dto);
  }
}
