import { IsEnum, IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
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
}
