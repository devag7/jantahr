import { ArgumentsHost, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

// Error bodies must never repeat the request URL, or anyone could make the domain display their own text.
function run(exception: unknown, url: string) {
  let sent: Record<string, unknown> = {};
  const res = { status: () => res, json: (b: Record<string, unknown>) => { sent = b; return res; } };
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => ({ method: 'GET', url }) }) } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return sent;
}

describe('AllExceptionsFilter', () => {
  const bait = '/api/Your%20account%20is%20locked%20call%20+1-800-555-0100';

  it('replaces the router 404 message and leaves out the path', () => {
    const body = run(new NotFoundException(`Cannot GET ${bait}`), bait);
    expect(body.message).toBe('There is no API endpoint at this address.');
    expect(body).not.toHaveProperty('path');
    expect(JSON.stringify(body)).not.toContain('555-0100');
  });

  it('keeps messages the app wrote itself', () => {
    expect(run(new NotFoundException('Employee not found'), '/api/employees/x').message).toBe('Employee not found');
  });
});
