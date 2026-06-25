/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Public Mapbox token (pk.…) for the Dashboard Yard Map — safe to expose client-side,
  // unlike the secret ANTHROPIC_API_KEY which stays server-side (no VITE_ prefix).
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
