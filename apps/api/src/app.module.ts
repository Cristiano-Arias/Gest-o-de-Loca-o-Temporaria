import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { HealthController } from './health/health.controller';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PropertiesModule } from './properties/properties.module';
import { ReservationsModule } from './reservations/reservations.module';
import { CostsModule } from './costs/costs.module';
import { RecurringCostsModule } from './recurring-costs/recurring-costs.module';
import { ImportModule } from './import/import.module';

@Module({
  imports: [
    // Carrega o .env da raiz do monorepo e o local da API.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PropertiesModule,
    ReservationsModule,
    CostsModule,
    RecurringCostsModule,
    ImportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
