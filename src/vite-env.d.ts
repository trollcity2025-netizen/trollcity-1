/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly DEV: boolean
    readonly PROD: boolean
    readonly MODE: string
    readonly SSR: boolean
    readonly VITE_APP_TITLE: string
    readonly VITE_APP_BASE_URL: string
    readonly VITE_SUPABASE_URL: string
    readonly VITE_SUPABASE_ANON_KEY: string
    readonly VITE_LIVEKIT_URL: string
    readonly VITE_LIVEKIT_API_KEY: string
    readonly VITE_LIVEKIT_API_SECRET: string
    readonly VITE_LIVEKIT_TOKEN_URL: string
    readonly VITE_EDGE_FUNCTIONS_URL: string
    // Add more env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
