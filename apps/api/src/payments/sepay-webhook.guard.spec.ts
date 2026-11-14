import {
  ExecutionContext,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SepayWebhookGuard } from './sepay-webhook.guard';

describe('SepayWebhookGuard', () => {
  const originalApiKey = process.env.SEPAY_API_KEY;

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.SEPAY_API_KEY;
    else process.env.SEPAY_API_KEY = originalApiKey;
  });

  function context(authorization: string): ExecutionContext {
    const request = { header: () => authorization };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  it('chấp nhận khóa API SePay đã cấu hình', () => {
    process.env.SEPAY_API_KEY = 'secret-key';

    expect(
      new SepayWebhookGuard().canActivate(context('Apikey secret-key')),
    ).toBe(true);
  });

  it('chặn khóa thiếu hoặc sai → 401', () => {
    process.env.SEPAY_API_KEY = 'secret-key';

    expect(() =>
      new SepayWebhookGuard().canActivate(context('Apikey wrong-key')),
    ).toThrow(UnauthorizedException);
    expect(() =>
      new SepayWebhookGuard().canActivate(context('')),
    ).toThrow(UnauthorizedException);
  });

  it('chưa cấu hình SEPAY_API_KEY → 503 (fail closed)', () => {
    delete process.env.SEPAY_API_KEY;

    expect(() =>
      new SepayWebhookGuard().canActivate(context('Apikey secret-key')),
    ).toThrow(ServiceUnavailableException);
  });
});
