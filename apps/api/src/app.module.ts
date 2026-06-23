import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';

@Module({
  imports: [
    // Carrega o .env da raiz do monorepo e o local da API.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    UsersModule,
    PropertiesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
