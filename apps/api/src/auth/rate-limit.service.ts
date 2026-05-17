import { Inject, Injectable, OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

@Injectable()
export class RateLimitService implements OnApplicationShutdown {
  private readonly redis: Redis;

  constructor(@Inject(ConfigService) configService: ConfigService) {
    this.redis = new Redis(configService.getOrThrow<string>("REDIS_URL"), {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async checkPinAttempt(key: string): Promise<RateLimitResult> {
    await this.ensureConnected();

    const lockKey = `pin-login:lock:${key}`;
    const attemptsKey = `pin-login:attempts:${key}`;
    const lockedTtl = await this.redis.ttl(lockKey);
    if (lockedTtl > 0) {
      return { allowed: false, retryAfterSeconds: lockedTtl };
    }

    const attempts = await this.redis.incr(attemptsKey);
    if (attempts === 1) {
      await this.redis.expire(attemptsKey, 5 * 60);
    }

    if (attempts > 5) {
      await this.redis.set(lockKey, "1", "EX", 10 * 60);
      return { allowed: false, retryAfterSeconds: 10 * 60 };
    }

    return { allowed: true };
  }

  async clearPinAttempts(key: string): Promise<void> {
    await this.ensureConnected();
    await this.redis.del(`pin-login:attempts:${key}`, `pin-login:lock:${key}`);
  }

  async onApplicationShutdown(): Promise<void> {
    this.redis.disconnect();
  }

  private async ensureConnected(): Promise<void> {
    if (this.redis.status === "wait") {
      await this.redis.connect();
    }
  }
}
