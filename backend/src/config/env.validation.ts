import { IsEnum, IsInt, IsOptional, IsString, Matches, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @Transform(({ value }) => parseInt(value as string, 10))
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  API_PREFIX: string = 'v1';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL: string = 'redis://localhost:6379';

  @IsString()
  JWT_ACCESS_SECRET!: string;

  @IsString()
  JWT_ACCESS_EXPIRATION: string = '15m';

  @IsString()
  JWT_REFRESH_EXPIRATION: string = '30d';

  @IsString()
  LOG_LEVEL: string = 'info';

  @IsString()
  CORS_ORIGIN: string = 'http://localhost:8081';

  // FIX-37: where the real client IP comes from, for rate limiting. Behind a proxy the
  // socket address is the proxy's, which would put every user in the same bucket.
  // CLIENT_IP_HEADER names a header set by the proxy itself (on Fly: fly-client-ip);
  // TRUST_PROXY_HOPS is Express's `trust proxy` hop count for X-Forwarded-For.
  // Both are off by default (development, tests); production requires one of them.
  @IsOptional()
  @Matches(/^[A-Za-z0-9-]+$/, { message: 'CLIENT_IP_HEADER must be an HTTP header name' })
  CLIENT_IP_HEADER?: string;

  @IsOptional()
  @Matches(/^(0|[1-9][0-9]?)$/, { message: 'TRUST_PROXY_HOPS must be an integer from 0 to 99' })
  TRUST_PROXY_HOPS?: string;

  // CORR-13 / Option B: push goes through the Expo Push Service. The access
  // token is optional (it only lifts the anonymous rate limit). The former
  // FIREBASE_SERVICE_ACCOUNT_BASE64 is no longer used.
  @IsOptional()
  @IsString()
  EXPO_ACCESS_TOKEN?: string;

  // Cloudflare R2 photo storage: all set → R2, none set → local disk.
  // Completeness, https public URL and "required in production" are enforced
  // by readR2Settings() in config.validation.ts.
  @IsOptional()
  @IsString()
  R2_ACCOUNT_ID?: string;

  @IsOptional()
  @IsString()
  R2_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  R2_SECRET_ACCESS_KEY?: string;

  @IsOptional()
  @IsString()
  R2_BUCKET_NAME?: string;

  @IsOptional()
  @IsString()
  R2_PUBLIC_URL?: string;

  // FEAT-10 overdue job. Opt-in: only the exact value 'true' enables it. The batch size
  // is a positive integer (default 100) and the max share a number in ]0, 1] (default
  // 0.5); an invalid value silently falls back to the default in LoansCronService
  // rather than blocking startup.
  @IsOptional()
  @IsString()
  OVERDUE_JOB_ENABLED?: string;

  @IsOptional()
  @IsString()
  OVERDUE_JOB_BATCH_SIZE?: string;

  @IsOptional()
  @IsString()
  OVERDUE_JOB_MAX_SHARE?: string;
}
