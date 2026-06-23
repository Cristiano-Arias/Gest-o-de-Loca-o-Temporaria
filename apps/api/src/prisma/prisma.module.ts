import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global: o PrismaService fica disponível para toda a aplicação.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
