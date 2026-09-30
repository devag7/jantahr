import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

const SENSITIVE = /password|token|secret|aadhaar|pan|account|otp|mfa/i;
const METHOD_ACTION: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' };

function redact(obj: unknown, depth = 0): unknown {
  if (obj === null || typeof obj !== 'object' || depth > 3) return obj;
  if (Array.isArray(obj)) return obj.slice(0, 20).map((v) => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, SENSITIVE.test(k) ? '[REDACTED]' : redact(v, depth + 1)]));
}

/** Immutable audit trail for every state-changing request made by an authenticated user. */
@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const action = METHOD_ACTION[req.method];
    if (!action) return next.handle();

    return next.handle().pipe(
      tap((result) => {
        const segments = String(req.route?.path || req.url).split('?')[0].split('/').filter(Boolean);
        const entityType = segments[0] === 'api' ? segments[1] : segments[0];
        const entityId = String(req.params?.id || result?.id || segments.filter((s: string) => !s.startsWith(':')).pop() || '-');
        this.prisma.auditLog
          .create({
            data: {
              userId: req.user?.userId ?? null,
              entityType: String(entityType || 'unknown').slice(0, 100),
              entityId: entityId.slice(0, 100),
              action: `${action}:${String(req.route?.path || '').slice(0, 30)}`.slice(0, 50),
              changes: JSON.stringify(redact(req.body ?? {})).slice(0, 4000),
              ipAddress: (req.ip || '').slice(0, 50),
              userAgent: String(req.headers['user-agent'] || '').slice(0, 250),
            },
          })
          .catch((e) => this.logger.warn(`audit write failed: ${e.message}`));
      }),
    );
  }
}
