import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  // Endpoint público para checar se a API está no ar.
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'C. Arias API',
      timestamp: new Date().toISOString(),
    };
  }
}
