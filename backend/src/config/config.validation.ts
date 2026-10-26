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

  const r2Settings = readR2Settings((key) => {
    const value = config[key];
    return typeof value === 'string' ? value : undefined;
  });
  if (!r2Settings && validated.NODE_ENV === Environment.Production) {
    throw new Error(
      'Config validation error:\nCloudflare R2 (R2_*) is required in production: ' +
        'the container disk is ephemeral and local photos would be lost on every deploy.',
    );
  }

  return validated;
}
