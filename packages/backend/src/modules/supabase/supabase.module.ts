import { Global, Module } from '@nestjs/common';
import { SupabaseController } from './supabase.controller';
import { SupabaseService } from './supabase.service';

@Global()
@Module({ controllers: [SupabaseController], providers: [SupabaseService], exports: [SupabaseService] })
export class SupabaseModule {}
