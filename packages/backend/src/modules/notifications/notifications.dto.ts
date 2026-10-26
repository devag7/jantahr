import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RemoveDeviceDto {
  @IsString() @MinLength(20) @MaxLength(512) token: string;
}

export class DeviceDto extends RemoveDeviceDto {
  @IsOptional() @IsIn(['android', 'ios']) platform?: 'android' | 'ios';
}
