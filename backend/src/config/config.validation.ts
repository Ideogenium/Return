import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { Environment, EnvironmentVariables } from './env.validation.js';
import { readR2Settings } from './r2-settings.js';

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Config validation error:\n${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n')}`,
    );
  }

  const raw = (key: string): string | undefined => {
    const value = config[key];
    return typeof value === 'string' ? value : undefined;
  };

  const r2Settings = readR2Settings(raw);
  if (validated.NODE_ENV === Environment.Production) {
    if (!r2Settings) {
      throw new Error(
        'Config validation error:\nCloudflare R2 (R2_*) is required in production: ' +
          'the container disk is ephemeral and local photos would be lost on every deploy.',
      );
    }
    assertProductionCorsOrigin(raw('CORS_ORIGIN'));
  }

  return validated;
}

// The class default (localhost) is a development convenience; production must
// name its allowed origin explicitly.
function assertProductionCorsOrigin(origin: string | undefined): void {
  const hostname = origin ? safeHostname(origin.trim()) : null;
  if (!hostname || ['localhost', '127.0.0.1', '[::1]'].includes(hostname)) {
    throw new Error(
      'Config validation error:\nCORS_ORIGIN must be set explicitly in production ' +
        'to a non-local origin (the localhost default is for development only).',
    );
  }
}

function safeHostname(origin: string): string | null {
  try {
    return new URL(origin).hostname;
  } catch {
    return null;
  }
}
