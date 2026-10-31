// Basculement progressif mock → backend réel, module par module
const MOCK_MODULES: Record<string, boolean> = {
  auth: false,
  borrowers: false,
  items: false,
  loans: false,
  reminders: false,
  notifications: false,
  users: false,
  'contact-invitations': false,
};

export function getBaseUrl(endpoint: string): string {
  const module = endpoint.split('/')[1]; // Ex: /auth/login → 'auth'

  // Prism ignore le basePath des servers — les routes sont directement sur /auth/login, /loans, etc.
  if (module && MOCK_MODULES[module]) {
    return 'http://localhost:4010'; // Prism mock server (pas de /v1)
  }

  // Override optionnel via .env (EXPO_PUBLIC_API_URL) : permet de viser le backend Fly.io
  // tout en restant en local (ex: test partagé avec un collègue sur le même back + BDD).
  // Sans override → localhost en dev, Fly.io en build prod.
  const defaultUrl = __DEV__ ? 'http://localhost:3000/v1' : 'https://return-api.fly.dev/v1';
  return process.env.EXPO_PUBLIC_API_URL ?? defaultUrl;
}
