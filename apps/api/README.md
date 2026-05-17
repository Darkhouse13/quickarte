# Quickarte API

## Local Services

M5 requires PostgreSQL and Redis for local development:

```sh
docker compose up -d postgres redis
```

Required API environment variables:

- `DATABASE_URL`
- `JWT_SECRET` with at least 32 characters
- `REDIS_URL`, defaulting to `redis://localhost:6379`

Redis backs PIN-login rate limiting. A missing Redis instance will make PIN login fail closed instead of accepting unlimited attempts.
