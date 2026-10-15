import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { ContactDto } from './contact.dto';
import { ContactService } from './contact.service';

@Controller('contact')
export class ContactController {
  constructor(private contact: ContactService) {}

  /** The public site's contact form. No sign-in; five messages an hour from one address. */
  @Public() @Throttle({ default: { limit: 5, ttl: 3600000 } }) @HttpCode(200)
  @Post() send(@Body() dto: ContactDto) { return this.contact.send(dto); }
}
