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
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface SupabaseClient {}
}

declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string, options?: any): any
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface SupabaseClient {}
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

declare module 'jsr:@supabase/functions-js/edge-runtime.d.ts' {}
