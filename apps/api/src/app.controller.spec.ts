import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { ConfigService } from '@nestjs/config';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, fallback: unknown) => fallback,
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return a healthy status payload', () => {
      expect(appController.getHealth()).toEqual({
        status: 'ok',
        api: 'community-ai',
        publicGroupsEnabled: true,
      });
    });
  });
});
