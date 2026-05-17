import {
  Body,
  Controller,
  Headers,
  HttpException,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsUUID, Matches } from "class-validator";
import type { Request } from "express";
import { AuthService, type TokenPair } from "./auth.service";
import { RateLimitService } from "./rate-limit.service";

const PROBLEM_BASE_URL = "https://api.quickarte.ma/problems";

class StaffPinLoginDto {
  @IsUUID()
  businessId!: string;

  @Matches(/^\d{4,6}$/)
  pin!: string;
}

@ApiTags("Auth")
@Controller("auth/staff")
export class PinLoginController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(RateLimitService) private readonly rateLimitService: RateLimitService,
  ) {}

  @Post("pin-login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Staff PIN login" })
  @ApiResponse({ status: 200, description: "Access and refresh tokens issued." })
  @ApiResponse({ status: 401, description: "Invalid PIN." })
  @ApiResponse({ status: 429, description: "Too many PIN attempts." })
  async login(
    @Body() body: StaffPinLoginDto,
    @Req() request: Request,
    @Headers("x-forwarded-for") forwardedFor?: string,
  ): Promise<TokenPair> {
    const ip = this.clientIp(request, forwardedFor);
    const rateKey = `${ip}:${body.businessId}`;
    const rateLimit = await this.rateLimitService.checkPinAttempt(rateKey);

    if (!rateLimit.allowed) {
      throw new HttpException(
        {
          type: `${PROBLEM_BASE_URL}/rate-limit-exceeded`,
          message: "Too many PIN attempts. Try again later.",
          retry_after_seconds: rateLimit.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    try {
      const result = await this.authService.issueStaffPinToken(body);
      await this.rateLimitService.clearPinAttempts(rateKey);
      return result;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw error;
    }
  }

  private clientIp(request: Request, forwardedFor?: string): string {
    const forwarded = forwardedFor?.split(",")[0]?.trim();
    return forwarded || request.ip || "unknown";
  }
}
