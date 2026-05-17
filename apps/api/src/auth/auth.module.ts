import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { DatabaseModule } from "../database/database.module";
import { PermissionsGuard } from "../common/guards/permissions.guard";
import { AuthService } from "./auth.service";
import { ApiJwtService } from "./jwt.strategy";
import { ManagerOverrideGuard } from "./manager-override.guard";
import { OwnerLoginController } from "./owner-login.controller";
import { PinHashingService } from "./pin-hashing.service";
import { PinLoginController } from "./pin-login.controller";
import { RateLimitService } from "./rate-limit.service";
import { RefreshController } from "./refresh.controller";

@Module({
  imports: [DatabaseModule],
  controllers: [PinLoginController, OwnerLoginController, RefreshController],
  providers: [
    ApiJwtService,
    AuthService,
    PinHashingService,
    RateLimitService,
    ManagerOverrideGuard,
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
  exports: [ApiJwtService, AuthService, ManagerOverrideGuard, PinHashingService],
})
export class AuthModule {}
