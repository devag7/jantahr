import { RequestMethod, Type } from '@nestjs/common';
import { HTTP_CODE_METADATA, METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { getMetadataStorage } from 'class-validator';
import { IS_PUBLIC_KEY, SIGNED_IN_ONLY_KEY } from '../common/decorators/public.decorator';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { FEATURE_KEY } from '../modules/billing/feature.guard';

/**
 * The OpenAPI 3.0 description of the REST API, built from what the code already declares: routes and their
 * parameters, the class-validator rules on each DTO, and the role, plan-feature and public markers the guards
 * enforce. Nothing is annotated twice, so the document cannot drift from the routes. Handlers do not declare what
 * they return, so success responses are described as JSON without a fixed shape; errors have one shape (the
 * exception filter's) and are fully typed.
 */

type Json = Record<string, unknown>;
type Class = Type<unknown>;

export interface ApiRoute {
  method: 'get' | 'post' | 'put' | 'patch' | 'delete';
  /** Path without the deployment's prefix, in OpenAPI form: /leave/types/{id} */
  path: string;
  handler: string;
  pathParams: string[];
  query: { name: string; }[];
  queryDto?: Class;
  body?: { dto?: Class; field?: string };
  /** The handler writes the response itself: a file download or a redirect. */
  rawResponse: boolean;
  successStatus: number;
  access: 'public' | 'signed-in' | 'account';
  roles: string[];
  feature?: string;
}

const METHODS: Partial<Record<RequestMethod, ApiRoute['method']>> = {
  [RequestMethod.GET]: 'get', [RequestMethod.POST]: 'post', [RequestMethod.PUT]: 'put', [RequestMethod.PATCH]: 'patch', [RequestMethod.DELETE]: 'delete',
};
const isDto = (t: unknown): t is Class => typeof t === 'function' && ![Object, String, Number, Boolean, Array, Date].includes(t as never);
const joinPath = (...parts: string[]) => '/' + parts.flatMap((p) => p.split('/')).filter(Boolean).join('/');

/** Routes a client may call. Scheduler hooks (internal/…) and payment-provider webhooks are not part of the API. */
const isCallable = (path: string) => !path.startsWith('/internal/') && !path.includes('/webhooks/');

/** Reads the routes of the given controllers from the metadata Nest's decorators leave on them. */
export function routesOf(controllers: Class[]): ApiRoute[] {
  const routes: ApiRoute[] = [];
  for (const controller of controllers) {
    const bases = ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, controller) ?? '');
    const proto = controller.prototype as Record<string, (...args: unknown[]) => unknown>;
    for (const handler of Object.getOwnPropertyNames(proto)) {
      const fn = proto[handler];
      if (handler === 'constructor' || typeof fn !== 'function') continue;
      const method = METHODS[Reflect.getMetadata(METHOD_METADATA, fn) as RequestMethod];
      if (!method || Reflect.getMetadata(PATH_METADATA, fn) === undefined) continue;
      const meta = <T>(key: string): T | undefined => Reflect.getMetadata(key, fn) ?? Reflect.getMetadata(key, controller);
      const args = Object.entries((Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, handler) ?? {}) as Record<string, { index: number; data?: unknown }>)
        .map(([key, arg]) => ({ kind: Number(key.split(':')[0]), index: arg.index, data: typeof arg.data === 'string' ? arg.data : undefined }));
      const types = (Reflect.getMetadata('design:paramtypes', proto, handler) ?? []) as unknown[];
      const bodyArg = args.find((a) => a.kind === RouteParamtypes.BODY);
      const queryDto = args.filter((a) => a.kind === RouteParamtypes.QUERY && !a.data).map((a) => types[a.index]).find(isDto);

      for (const base of bases) for (const sub of ([] as string[]).concat(Reflect.getMetadata(PATH_METADATA, fn))) {
        const raw = joinPath(base, sub);
        const path = raw.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
        if (!isCallable(path)) continue;
        routes.push({
          method, path, handler,
          pathParams: [...raw.matchAll(/:([A-Za-z0-9_]+)/g)].map((m) => m[1]),
          query: args.filter((a) => a.kind === RouteParamtypes.QUERY && a.data).sort((a, b) => a.index - b.index).map((a) => ({ name: a.data! })),
          ...(queryDto ? { queryDto } : {}),
          ...(bodyArg ? { body: { ...(isDto(types[bodyArg.index]) && !bodyArg.data ? { dto: types[bodyArg.index] as Class } : {}), ...(bodyArg.data ? { field: bodyArg.data } : {}) } } : {}),
          rawResponse: args.some((a) => a.kind === RouteParamtypes.RESPONSE),
          successStatus: (Reflect.getMetadata(HTTP_CODE_METADATA, fn) as number | undefined) ?? (method === 'post' ? 201 : 200),
          access: meta<boolean>(IS_PUBLIC_KEY) ? 'public' : meta<boolean>(SIGNED_IN_ONLY_KEY) ? 'signed-in' : 'account',
          roles: Array.from(new Set(meta<string[]>(ROLES_KEY) ?? [])),
          ...(meta<string>(FEATURE_KEY) ? { feature: meta<string>(FEATURE_KEY) } : {}),
        });
      }
    }
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

interface Rule { type: string; name?: string; propertyName: string; constraints?: unknown[]; each?: boolean }

/** The class a nested property holds, from class-transformer's @Type(() => X). */
function nestedType(target: Class, property: string): Class | undefined {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { defaultMetadataStorage } = require('class-transformer/cjs/storage');
    const found = defaultMetadataStorage.findTypeMetadata(target, property)?.typeFunction?.();
    return isDto(found) ? found : undefined;
  } catch { return undefined; }
}

/** JSON Schema for one property from its class-validator rules. `ref` names the schema of a nested DTO. */
export function propertySchema(rules: Rule[], ref?: string): { schema: Json; required: boolean } {
  const item: Json = {};
  let array = false;
  const list: Json = {};
  for (const rule of rules) {
    const [first, second] = rule.constraints ?? [];
    const target = rule.each ? ((array = true), item) : item;
    switch (rule.name) {
      case 'isString': target.type = 'string'; break;
      case 'isEmail': target.type = 'string'; target.format = 'email'; break;
      // a plain date (2026-10-01) passes as well as a date-time, so no stricter format is claimed
      case 'isDateString': target.type = 'string'; target.description = 'ISO 8601 date or date-time'; break;
      case 'isBoolean': target.type = 'boolean'; break;
      case 'isInt': target.type = 'integer'; break;
      case 'isNumber': target.type ??= 'number'; break;
      case 'isEnum': target.type = 'string'; target.enum = (Array.isArray(second) ? second : Object.values((first ?? {}) as object)).filter((v) => typeof v === 'string'); break;
      case 'isIn': if (Array.isArray(first)) { target.enum = first; target.type ??= typeof first[0] === 'number' ? 'number' : 'string'; } break;
      case 'equals': target.enum = [first]; break;
      case 'min': target.minimum = first; break;
      case 'max': target.maximum = first; break;
      case 'minLength': target.minLength = first; break;
      case 'maxLength': target.maxLength = first; break;
      case 'isNotEmpty': target.minLength ??= 1; break;
      case 'matches': if (first instanceof RegExp) { target.type ??= 'string'; target.pattern = first.source; } break;
      case 'isArray': array = true; break;
      case 'arrayMinSize': array = true; list.minItems = first; break;
      case 'arrayMaxSize': array = true; list.maxItems = first; break;
      default: break;
    }
  }
  const required = !rules.some((r) => r.type === 'conditionalValidation');
  const element = ref ? { $ref: ref } : item;
  return { schema: array ? { type: 'array', items: element, ...list } : element, required };
}

/** Adds the schema of a DTO class (and the DTOs nested in it) to `schemas`, and returns its name. */
export function addDtoSchema(dto: Class, schemas: Record<string, Json>): string {
  const name = dto.name;
  if (schemas[name]) return name;
  const properties: Record<string, Json> = {};
  schemas[name] = { type: 'object', properties };
  const byProperty = new Map<string, Rule[]>();
  for (const rule of getMetadataStorage().getTargetValidationMetadatas(dto, '', false, false) as unknown as Rule[]) {
    byProperty.set(rule.propertyName, [...(byProperty.get(rule.propertyName) ?? []), rule]);
  }
  const required: string[] = [];
  for (const [property, rules] of byProperty) {
    const nested = rules.some((r) => r.type === 'nestedValidation') ? nestedType(dto, property) : undefined;
    const { schema, required: needed } = propertySchema(rules, nested ? `#/components/schemas/${addDtoSchema(nested, schemas)}` : undefined);
    properties[property] = schema;
    if (needed) required.push(property);
  }
  if (required.length) schemas[name].required = required;
  return name;
}

const words = (camel: string) => camel.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[-_]+/g, ' ').toLowerCase().trim();
const title = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const listOf = (items: string[]) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items[items.length - 1]}`);

function accessText(route: ApiRoute): string {
  if (route.access === 'public') return 'No sign-in needed.';
  if (route.access === 'signed-in') return 'Needs a signed-in user; a JantaHR company account is not required yet.';
  return route.roles.length ? `Needs a signed-in user with the role ${listOf(route.roles)}.` : 'Needs a signed-in user of the company; any role.';
}

export interface OpenApiOptions { title: string; version: string; description: string; serverUrl: string; rateLimit: { limit: number; windowSeconds: number }; contactUrl?: string }

export function buildOpenApi(routes: ApiRoute[], options: OpenApiOptions): Json {
  const schemas: Record<string, Json> = {
    Error: {
      type: 'object',
      description: 'Every error response has this shape.',
      required: ['statusCode', 'error', 'message', 'path', 'timestamp'],
      properties: {
        statusCode: { type: 'integer', description: 'The HTTP status code, repeated' },
        error: { type: 'string', description: 'Short name of the error, for example "Forbidden"' },
        message: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'What went wrong; a list when several fields failed validation' },
        code: { type: 'string', description: 'Machine-readable reason where one applies, for example PLAN_REQUIRED, SEAT_LIMIT, SESSION_INVALID or NO_ACCOUNT' },
        feature: { type: 'string', description: 'The plan feature the request needs, with code PLAN_REQUIRED' },
        path: { type: 'string' },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  };
  const error = (description: string) => ({ description, content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } });
  // error responses are the same for every operation, so each is defined once and referenced
  const responseDefs = {
    BadRequest: error('The request body or a parameter failed validation.'),
    Unauthorized: error('No valid access token was sent, or the session has ended.'),
    Forbidden: error('The signed-in user’s role or the company’s plan does not allow this.'),
    NotFound: error('No such record in this company.'),
    TooManyRequests: error(`More than ${options.rateLimit.limit} requests in ${options.rateLimit.windowSeconds} seconds from one address.`),
  };
  const shared = (name: keyof typeof responseDefs) => ({ $ref: `#/components/responses/${name}` });
  const paths: Record<string, Record<string, Json>> = {};
  const tags = new Set<string>();
  const ids = new Set<string>();

  for (const route of routes) {
    const tag = route.path.split('/')[1] || 'root';
    tags.add(tag);
    let operationId = `${tag.replace(/[^A-Za-z0-9]+/g, '_')}_${route.handler}`.slice(0, 64);
    for (let n = 2; ids.has(operationId); n += 1) operationId = `${tag.replace(/[^A-Za-z0-9]+/g, '_')}_${route.handler}`.slice(0, 61) + `_${n}`;
    ids.add(operationId);

    const parameters: Json[] = [
      ...route.pathParams.map((name) => ({ name, in: 'path', required: true, schema: { type: 'string' } })),
      // a named query argument is read as text and nothing rejects a request that leaves it out
      ...route.query.map(({ name }) => ({ name, in: 'query', required: false, schema: { type: 'string' } })),
    ];
    if (route.queryDto) {
      const dto = schemas[addDtoSchema(route.queryDto, schemas)] as { properties: Record<string, Json>; required?: string[] };
      for (const [name, schema] of Object.entries(dto.properties)) {
        if (!parameters.some((p) => p.name === name && p.in === 'query')) parameters.push({ name, in: 'query', required: !!dto.required?.includes(name), schema });
      }
    }
    const bodySchema = !route.body ? undefined
      : route.body.dto ? { $ref: `#/components/schemas/${addDtoSchema(route.body.dto, schemas)}` }
        : route.body.field ? { type: 'object', properties: { [route.body.field]: {} }, required: [route.body.field] }
          : { type: 'object', additionalProperties: true };

    const responses: Record<string, Json> = {
      [route.successStatus]: route.rawResponse
        ? { description: 'The file or stream the operation produces (for example a PDF or CSV), sent as a download.', content: { '*/*': { schema: { type: 'string', format: 'binary' } } } }
        : { description: 'The result as JSON: an object or a list, depending on the operation.', content: { 'application/json': { schema: {} } } },
      ...(bodySchema || parameters.length ? { 400: shared('BadRequest') } : {}),
      ...(route.access !== 'public' ? { 401: shared('Unauthorized') } : {}),
      ...(route.access === 'account' ? { 403: shared('Forbidden') } : {}),
      ...(route.pathParams.length ? { 404: shared('NotFound') } : {}),
      429: shared('TooManyRequests'),
    };

    const summary = `${title(words(tag))}: ${words(route.handler)}`;
    (paths[route.path] ??= {})[route.method] = {
      operationId,
      tags: [tag],
      summary,
      description: [`${summary} (${route.method.toUpperCase()} ${route.path}).`, accessText(route), route.feature ? `On the cloud edition the company’s plan must include the “${route.feature}” feature.` : ''].filter(Boolean).join(' '),
      ...(parameters.length ? { parameters } : {}),
      ...(bodySchema ? { requestBody: { required: true, content: { 'application/json': { schema: bodySchema } } } } : {}),
      responses,
      security: route.access === 'public' ? [] : [{ bearerAuth: [] }],
      ...(route.roles.length ? { 'x-required-roles': route.roles } : {}),
      ...(route.feature ? { 'x-required-feature': route.feature } : {}),
    };
  }

  return {
    openapi: '3.0.3',
    info: {
      title: options.title, version: options.version, description: options.description,
      license: { name: 'AGPL-3.0', url: 'https://www.gnu.org/licenses/agpl-3.0.html' },
      ...(options.contactUrl ? { contact: { name: 'JantaHR', url: options.contactUrl } } : {}),
    },
    servers: [{ url: options.serverUrl }],
    tags: [...tags].sort().map((name) => ({ name, description: `${title(words(name))} operations` })),
    paths,
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'A Supabase Auth access token for the signed-in user. The API maps it to the user’s JantaHR account, company and role.' } },
      schemas: Object.fromEntries(Object.entries(schemas).sort(([a], [b]) => a.localeCompare(b))),
      responses: responseDefs,
    },
    'x-rate-limit': { limit: options.rateLimit.limit, windowSeconds: options.rateLimit.windowSeconds, scope: 'per client address' },
  };
}

export const API_DESCRIPTION = [
  'REST API of JantaHR, open-source HR and payroll software for India: employees, leave, attendance, payroll with PF, ESI, TDS and professional tax, compliance, lifecycle, performance, recruitment and privacy requests.',
  'Send a Supabase Auth access token as a bearer token. Every call acts as that signed-in user: it sees only their company and can do only what their role allows. There are no API keys.',
  'Requests and responses are JSON. Amounts are in Indian rupees. Errors share one shape (the Error schema).',
].join('\n\n');

/** Every controller reachable from a module, following its imports (plain and dynamic modules alike). */
export function controllersOf(root: unknown, seen = new Set<unknown>()): Class[] {
  const module = (root as { module?: unknown })?.module ?? root;
  if (typeof module !== 'function' || seen.has(module)) return [];
  seen.add(module);
  const own = (Reflect.getMetadata('controllers', module) ?? []) as Class[];
  const imports = [...((Reflect.getMetadata('imports', module) ?? []) as unknown[]), ...(((root as { imports?: unknown[] })?.imports) ?? [])];
  return [...own, ...imports.flatMap((m) => controllersOf(m, seen))];
}

/** The document for this deployment. `prefix` is the path the API is mounted at ("api" on Vercel, "" elsewhere). */
export function openApiDocument(rootModule: unknown, prefix: string): Json {
  return buildOpenApi(routesOf(controllersOf(rootModule)), {
    title: 'JantaHR API', version: '1.0.0', description: API_DESCRIPTION, serverUrl: prefix ? `/${prefix}` : '/',
    rateLimit: { limit: 300, windowSeconds: 60 }, contactUrl: 'https://github.com/devag7/jantahr',
  });
}
