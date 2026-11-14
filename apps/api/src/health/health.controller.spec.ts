import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  const makeController = (queryRaw: jest.Mock) =>
    new HealthController({ $queryRaw: queryRaw } as never);

  it('trả trạng thái ok khi database phản hồi', async () => {
    const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    const controller = makeController(queryRaw);

    await expect(controller.check()).resolves.toMatchObject({
      status: 'ok',
      database: 'up',
    });
    expect(queryRaw).toHaveBeenCalled();
  });

  it('trả 503 khi database không phản hồi', async () => {
    const queryRaw = jest.fn().mockRejectedValue(new Error('db down'));
    const controller = makeController(queryRaw);

    await expect(controller.check()).rejects.toThrow(ServiceUnavailableException);
  });
});
