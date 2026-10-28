import { Injectable, Logger } from '@nestjs/common';
import { mkdir, writeFile, unlink, access, readdir, rm } from 'node:fs/promises';
import { join, dirname, resolve, sep } from 'node:path';
import { ConfigService } from '@nestjs/config';

import type { PhotoStorage, PhotoUploadResult } from './interfaces/photo-storage.interface.js';
import { assertPurgePrefix } from './purge-prefix.js';

// =============================================================================
// LocalPhotoStorage — Implémentation disque local (dev / tests)
// =============================================================================
// Stocke les fichiers dans <uploadDir>/ et sert les URLs via le baseUrl configuré.
// Remplaçable par R2PhotoStorage en production sans modifier le code métier (LSP).
// =============================================================================

@Injectable()
export class LocalPhotoStorageService implements PhotoStorage {
  private readonly logger = new Logger(LocalPhotoStorageService.name);
  private readonly uploadDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.uploadDir = this.configService.get<string>('UPLOAD_DIR', join(process.cwd(), 'uploads'));
    this.baseUrl = this.configService.get<string>(
      'UPLOAD_BASE_URL',
      'http://localhost:3000/uploads',
    );
  }

  async upload(file: Buffer, key: string): Promise<PhotoUploadResult> {
    const filePath = join(this.uploadDir, key);

    // Créer les répertoires intermédiaires si nécessaire
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file);

    this.logger.debug(`Photo uploaded locally: ${key}`);

    const url = `${this.baseUrl}/${key}`;

    return {
      key,
      url,
      thumbnailUrl: null, // Pas de génération de vignettes en local (V1)
    };
  }

  async delete(key: string): Promise<void> {
    // Support both storage keys ("items/...") and full URLs ("http://...uploads/items/...")
    const resolvedKey = key.startsWith('http') ? key.replace(`${this.baseUrl}/`, '') : key;
    const filePath = join(this.uploadDir, resolvedKey);

    try {
      await access(filePath);
      await unlink(filePath);
      this.logger.debug(`Photo deleted locally: ${key}`);
    } catch {
      // Fichier inexistant → idempotent, pas d'erreur
      this.logger.debug(`Photo not found locally (idempotent delete): ${key}`);
    }
  }

  async deleteByPrefix(prefix: string): Promise<number> {
    assertPurgePrefix(prefix);

    // Defense in depth: the resolved folder must stay strictly inside uploadDir.
    const root = resolve(this.uploadDir);
    const folder = resolve(root, prefix);
    if (!folder.startsWith(root + sep)) {
      throw new Error(`Refusing to purge a prefix outside the upload directory: "${prefix}"`);
    }

    let files: string[];
    try {
      const entries = await readdir(folder, { recursive: true, withFileTypes: true });
      files = entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
    } catch {
      // Absent folder → idempotent, nothing to delete
      return 0;
    }

    await rm(folder, { recursive: true, force: true });
    this.logger.debug(`Purged ${files.length} photo(s) locally under ${prefix}`);
    return files.length;
  }

  getUrl(key: string): Promise<string> {
    return Promise.resolve(`${this.baseUrl}/${key}`);
  }
}
