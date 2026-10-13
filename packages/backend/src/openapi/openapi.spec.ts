import 'reflect-metadata';
import { Body, Controller, Get, HttpCode, Param, Post, Query, Res } from '@nestjs/common';
import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, MinLength, ValidateNested } from 'class-validator';
import { AppModule } from '../app.module';
import { Public, SignedInOnly } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RequiresFeature } from '../modules/billing/feature.guard';
import { addDtoSchema, buildOpenApi, controllersOf, openApiDocument, routesOf } from './openapi';

enum Colour { RED = 'RED', BLUE = 'BLUE' }
class LineDto { @IsString() itemId: string; @Type(() => Number) @IsInt() @Min(1) @Max(99) quantity: number; }
class OrderDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsBoolean() gift?: boolean;
  @IsOptional() @IsEnum(Colour) colour?: Colour;
  @IsOptional() @IsIn(['MONTHLY', 'ANNUAL']) cycle?: string;
  @IsOptional() @IsDateString() due?: string;
  @IsOptional() @Matches(/^[A-Z]{5}\d{4}[A-Z]$/) pan?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) labels?: string[];
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => LineDto) lines: LineDto[];
}
class UpdateOrderDto extends PartialType(OrderDto) {}
class ListDto { @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number; @IsOptional() @IsString() search?: string; }

@Controller('orders')
class OrdersController {
  @Get() list(@Query() _q: ListDto, @Query('status') _status?: string) { return []; }
  @Roles('HR_ADMIN' as never, 'SUPER_ADMIN' as never) @Post() create(@Body() _dto: OrderDto) { return {}; }
  @RequiresFeature('payroll') @Post(':id/close') @HttpCode(200) close(@Param('id') _id: string, @Body() _dto: UpdateOrderDto) { return {}; }
  @Get(':id/pdf') pdf(@Param('id') _id: string, @Res() _res: unknown) { /* streams */ }
  @Public() @Get('plans') plans() { return []; }
  @SignedInOnly() @Post('provision') provision(@Body('name') _name: string) { return {}; }
  @Public() @Post('webhooks/razorpay') hook() { return {}; }
  helper() { return 1; }
}
@Controller('internal/jobs') class JobsController { @Get(':name') run(@Param('name') _n: string) { return {}; } }
@Controller('orders') class MoreOrdersController { @Get('export') list() { return []; } }

const options = { title: 'T', version: '1', description: 'D', serverUrl: '/api', rateLimit: { limit: 300, windowSeconds: 60 } };
type Op = { operationId: string; description: string; summary: string; parameters?: { name: string; in: string; required: boolean; schema: unknown }[]; requestBody?: { content: Record<string, { schema: Record<string, unknown> }> }; responses: Record<string, { content?: Record<string, { schema: unknown }> }>; security: unknown[]; [k: string]: unknown };
type Doc = { openapi: string; paths: Record<string, Record<string, Op>>; components: { schemas: Record<string, { properties: Record<string, unknown>; required?: string[] }>; securitySchemes: Record<string, unknown> }; servers: { url: string }[] };
const operations = (doc: Doc) => Object.entries(doc.paths).flatMap(([path, item]) => Object.entries(item).map(([method, op]) => ({ path, method, op })));

describe('OpenAPI generator', () => {
  const doc = buildOpenApi(routesOf([OrdersController, JobsController, MoreOrdersController]), options) as unknown as Doc;

  it('lists the callable routes and leaves out scheduler hooks, webhooks and plain methods', () => {
    expect(Object.keys(doc.paths).sort()).toEqual(['/orders', '/orders/export', '/orders/plans', '/orders/provision', '/orders/{id}/close', '/orders/{id}/pdf']);
    expect(Object.keys(doc.paths['/orders']).sort()).toEqual(['get', 'post']);
  });

  it('gives every operation a unique id that a function-calling model accepts', () => {
    const ids = operations(doc).map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => expect(id).toMatch(/^[A-Za-z0-9_-]{1,64}$/));
    expect(ids).toEqual(expect.arrayContaining(['orders_list', 'orders_list_2', 'orders_create']));
  });

  it('describes who may call an operation, from the guards’ own markers', () => {
    const create = doc.paths['/orders'].post;
    expect(create.description).toContain('role HR_ADMIN or SUPER_ADMIN');
    expect(create['x-required-roles']).toEqual(['HR_ADMIN', 'SUPER_ADMIN']);
    expect(create.security).toEqual([{ bearerAuth: [] }]);
    expect(Object.keys(create.responses)).toEqual(expect.arrayContaining(['201', '400', '401', '403', '429']));
    const plans = doc.paths['/orders/plans'].get;
    expect(plans.security).toEqual([]);
    expect(plans.description).toContain('No sign-in needed');
    expect(plans.responses['401']).toBeUndefined();
    expect(doc.paths['/orders/provision'].post.responses['403']).toBeUndefined();
    const close = doc.paths['/orders/{id}/close'].post;
    expect(close['x-required-feature']).toBe('payroll');
    expect(Object.keys(close.responses)).toEqual(expect.arrayContaining(['200', '404']));
    expect(close.responses['201']).toBeUndefined();
  });

  it('types path, named query and DTO query parameters', () => {
    expect(doc.paths['/orders'].get.parameters).toEqual([
      { name: 'status', in: 'query', required: false, schema: { type: 'string' } },
      { name: 'page', in: 'query', required: false, schema: { type: 'integer', minimum: 1 } },
      { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
    ]);
    expect(doc.paths['/orders/{id}/close'].post.parameters).toEqual([{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }]);
  });

  it('builds request schemas from the class-validator rules, nested DTOs included', () => {
    expect(doc.paths['/orders'].post.requestBody!.content['application/json'].schema).toEqual({ $ref: '#/components/schemas/OrderDto' });
    const order = doc.components.schemas.OrderDto;
    expect(order.required!.sort()).toEqual(['lines', 'name']);
    expect(order.properties).toEqual({
      name: { type: 'string', minLength: 2 },
      gift: { type: 'boolean' },
      colour: { type: 'string', enum: ['RED', 'BLUE'] },
      cycle: { type: 'string', enum: ['MONTHLY', 'ANNUAL'] },
      due: { type: 'string', description: 'ISO 8601 date or date-time' },
      pan: { type: 'string', pattern: '^[A-Z]{5}\\d{4}[A-Z]$' },
      labels: { type: 'array', items: { type: 'string' } },
      lines: { type: 'array', items: { $ref: '#/components/schemas/LineDto' }, minItems: 1 },
    });
    expect(doc.components.schemas.LineDto.properties.quantity).toEqual({ type: 'integer', minimum: 1, maximum: 99 });
    expect(doc.components.schemas.UpdateOrderDto.required).toBeUndefined();
    expect(Object.keys(doc.components.schemas.UpdateOrderDto.properties).sort()).toEqual(Object.keys(order.properties).sort());
    expect(doc.paths['/orders/provision'].post.requestBody!.content['application/json'].schema).toEqual({ type: 'object', properties: { name: {} }, required: ['name'] });
  });

  it('marks a handler that writes its own response as a download', () => {
    expect(doc.paths['/orders/{id}/pdf'].get.responses['200'].content).toEqual({ '*/*': { schema: { type: 'string', format: 'binary' } } });
  });

  it('adds a DTO once however often it is used', () => {
    const schemas = {};
    expect(addDtoSchema(OrderDto, schemas)).toBe('OrderDto');
    expect(addDtoSchema(OrderDto, schemas)).toBe('OrderDto');
    expect(Object.keys(schemas).sort()).toEqual(['LineDto', 'OrderDto']);
  });
});

describe('OpenAPI document of the real API', () => {
  const doc = openApiDocument(AppModule, 'api') as unknown as Doc;
  const all = operations(doc);

  it('covers the API and is valid OpenAPI 3.0 in outline', () => {
    expect(doc.openapi).toBe('3.0.3');
    expect(doc.servers).toEqual([{ url: '/api' }]);
    expect(controllersOf(AppModule).length).toBeGreaterThan(20);
    expect(all.length).toBeGreaterThan(150);
    expect(doc.components.securitySchemes.bearerAuth).toBeDefined();
    expect(doc.paths['/health'].get.security).toEqual([]);
    expect(doc.paths['/leave/applications'].post.requestBody!.content['application/json'].schema).toEqual({ $ref: '#/components/schemas/ApplyLeaveDto' });
  });

  it('hides scheduler hooks and payment webhooks', () => {
    expect(Object.keys(doc.paths).filter((p) => p.startsWith('/internal') || p.includes('webhook'))).toEqual([]);
  });

  it('gives every operation a unique id, a summary, a description, typed parameters and responses', () => {
    const ids = all.map((o) => o.op.operationId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const { path, method, op } of all) {
      const where = `${method.toUpperCase()} ${path}`;
      expect([where, op.operationId]).toEqual([where, expect.stringMatching(/^[A-Za-z0-9_-]{1,64}$/)]);
      expect([where, op.summary.length > 5, op.description.length > 20]).toEqual([where, true, true]);
      expect([where, Object.keys(op.responses).some((code) => code.startsWith('2'))]).toEqual([where, true]);
      for (const p of op.parameters ?? []) expect([where, p.name, !!p.schema]).toEqual([where, p.name, true]);
      // every {param} in the path is declared
      const declared = (op.parameters ?? []).filter((p) => p.in === 'path').map((p) => p.name).sort();
      expect([where, declared]).toEqual([where, [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()]);
    }
  });

  it('resolves every shared response and never repeats a role', () => {
    const responses = (doc.components as unknown as { responses: Record<string, unknown> }).responses;
    const refs = [...JSON.stringify(doc.paths).matchAll(/"\$ref":"#\/components\/responses\/([^"]+)"/g)].map((m) => m[1]);
    expect(refs.filter((name) => !responses[name])).toEqual([]);
    for (const { op } of all) { const roles = (op['x-required-roles'] ?? []) as string[]; expect(new Set(roles).size).toBe(roles.length); }
  });

  it('resolves every schema reference', () => {
    const refs = [...JSON.stringify(doc).matchAll(/"\$ref":"#\/components\/schemas\/([^"]+)"/g)].map((m) => m[1]);
    expect(refs.length).toBeGreaterThan(50);
    expect(refs.filter((name) => !doc.components.schemas[name])).toEqual([]);
  });

  it('describes request bodies with real properties, not empty objects', () => {
    const empty = Object.entries(doc.components.schemas).filter(([name, s]) => name !== 'Error' && Object.keys(s.properties ?? {}).length === 0).map(([name]) => name);
    expect(empty).toEqual([]);
  });
});
