import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller()
export class AppController {
  constructor(private readonly configService: ConfigService) {}

  @Get()
  getHealth() {
    return {
      status: 'ok',
      api: 'community-ai',
      publicGroupsEnabled:
        this.configService.get('FEATURE_PUBLIC_GROUPS') !== 'false',
    };
  }
}
