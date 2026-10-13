/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STAND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
