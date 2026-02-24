// ✅ FILE: src/app.module.ts

import { Module, MiddlewareConsumer, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { CarsModule } from "./cars/cars.module";
import { CatalogModule } from "./catalog/catalog.module";
import { UsersModule } from "./users/users.module";
import { VerificationModule } from "./verification/verification.module";
import { OtpModule } from "./otp/otp.module";
import { PaymentsModule } from "./payments/payments.module"; // ✅ ADD

import { AuthRateLimitMiddleware } from "./security/auth-rate-limit.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CarsModule,
    CatalogModule,
    UsersModule,
    VerificationModule,
    OtpModule,
    PaymentsModule, // ✅ ADD
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthRateLimitMiddleware)
      .forRoutes(
        { path: "auth/login", method: RequestMethod.POST },
        { path: "auth/register", method: RequestMethod.POST }
      );
  }
}