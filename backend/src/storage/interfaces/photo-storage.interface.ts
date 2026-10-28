// =============================================================================
// PhotoStorage — Interface abstraite (DIP / LSP)
// =============================================================================
// Contrat pour le stockage de photos d'objets et avatars.
// Implémentations : LocalPhotoStorage (dev), R2PhotoStorage (production).
// Injection via @Inject('PHOTO_STORAGE').
// =============================================================================

/**
 * Résultat d'un upload de photo.
 */
export interface PhotoUploadResult {
  /** Clé unique du fichier stocké (ex: "items/<itemId>/<timestamp>.jpg") */
  key: string;
  /** URL publique ou signée de la photo */
  url: string;
  /** URL de la vignette (150×150px), null si non générée */
  thumbnailUrl: string | null;
}

/**
 * Abstraction du service de stockage de photos.
 * Permet de substituer l'implémentation (S3/local → R2) sans modifier le code métier (LSP).
 */
export interface PhotoStorage {
  /**
   * Upload un fichier et retourne les URLs.
   * @param file   Buffer du fichier image
   * @param key    Chemin logique (ex: "items/<itemId>/<uuid>.jpg")
   */
  upload(file: Buffer, key: string): Promise<PhotoUploadResult>;

  /**
   * Supprime un fichier par sa clé.
   * Ne lance pas d'erreur si le fichier n'existe pas (idempotent).
   */
  delete(key: string): Promise<void>;

  /**
   * Retourne l'URL (signée si nécessaire) d'un fichier existant.
   */
  getUrl(key: string): Promise<string>;

  /**
   * Supprime tous les fichiers dont la clé commence par `prefix` (ex: "users/<userId>/")
   * et retourne leur nombre. Idempotent (0 si rien). Refuse un préfixe vide ou partiel.
   */
  deleteByPrefix(prefix: string): Promise<number>;
}

/** Token d'injection NestJS pour le provider PhotoStorage */
export const PHOTO_STORAGE = 'PHOTO_STORAGE';
