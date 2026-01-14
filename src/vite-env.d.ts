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
    readonly VITE_LIVEKIT_CLOUD_URL?: string
    readonly VITE_LIVEKIT_API_KEY: string
    readonly VITE_LIVEKIT_API_SECRET: string
    readonly VITE_LIVEKIT_TOKEN_URL: string
    readonly VITE_EDGE_FUNCTIONS_URL: string
    readonly VITE_SUPABASE_FUNCTIONS_URL: string
    readonly VITE_APP_VERSION?: string
    readonly VITE_PUBLIC_APP_VERSION?: string
    readonly VITE_VAPID_PUBLIC_KEY?: string
    // Add more env variables as needed
}

interface ImportMeta {
    readonly env: ImportMetaEnv
}
