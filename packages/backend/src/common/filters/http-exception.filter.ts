import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const req = host.switchToHttp().getRequest();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';
    let extra: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse() as string | { message?: string | string[]; error?: string; code?: string; feature?: string };
      message = typeof body === 'string' ? body : body.message ?? exception.message;
      error = typeof body === 'string' ? exception.name : body.error ?? exception.name;
      // machine-readable fields (e.g. code: PLAN_REQUIRED | SEAT_LIMIT, feature) for the web app
      if (typeof body === 'object' && body) { if (body.code) extra.code = body.code; if (body.feature) extra.feature = body.feature; }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = `Duplicate value for ${((exception.meta?.target as string[]) || []).join(', ') || 'a unique field'}`;
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'Record not found';
          break;
        case 'P2003':
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = 'This record is referenced by other data and cannot be changed or removed';
          break;
        default:
          this.logger.error(`${req.method} ${req.url}: Prisma ${exception.code}: ${exception.message}`);
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Invalid data supplied';
      this.logger.warn(exception.message.split('\n').slice(-3).join(' '));
    } else {
      this.logger.error(`${req.method} ${req.url}`, (exception as Error)?.stack);
    }

    res.status(status).json({ statusCode: status, error, message, ...extra, path: req.url, timestamp: new Date().toISOString() });
  }
}
