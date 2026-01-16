// Deno global types
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

// Supabase types
declare module 'jsr:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: any): any
  export type SupabaseClient = object
}

declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string, options?: any): any
  export type SupabaseClient = object
}

declare module 'livekit-server-sdk' {
  export class AccessToken {
    constructor(apiKey: string, apiSecret: string, options?: any);
    addGrant(grant: any): void;
    toJwt(): Promise<string>;
  }
  export enum TrackSource {
    CAMERA = 'camera',
    MICROPHONE = 'microphone'
  }
}

declare module 'https://deno.land/std@0.177.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://deno.land/std@0.168.0/http/server.ts' {
  export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: any): any
  export type SupabaseClient = object
}

declare module 'https://esm.sh/@supabase/supabase-js@2.39.3?target=deno' {
  export function createClient(url: string, key: string, options?: any): any
}

declare module 'https://esm.sh/stripe@14.25.0?target=deno' {
  const Stripe: any
  export default Stripe
}

declare module 'jsr:@supabase/functions-js/edge-runtime.d.ts' {}
