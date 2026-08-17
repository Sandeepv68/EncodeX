/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APTABASE_APP_KEY: string;
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
