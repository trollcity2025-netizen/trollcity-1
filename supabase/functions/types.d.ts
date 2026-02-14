// Deno global types
declare namespace Deno {
  namespace env {
    function get(key: string): string | undefined;
  }
  function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

// Supabase types
declare module 'https://esm.sh/@supabase/supabase-js@2.39.7' {
  export function createClient(url: string, key: string, options?: any): any
  export type SupabaseClient = object
}

declare module 'https://esm.sh/@upstash/redis@1.28.4' {
  export class Redis {
    constructor(config: { url: string; token: string });
    xadd(key: string, id: string, fields: Record<string, string>): Promise<string>;
    get(key: string): Promise<any>;
    set(key: string, value: any, options?: { nx?: boolean; ex?: number }): Promise<any>;
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
  }
}

declare module '@upstash/redis' {
  export class Redis {
    constructor(config: { url: string; token: string });
    xadd(key: string, id: string, fields: Record<string, string>): Promise<string>;
    get(key: string): Promise<any>;
    set(key: string, value: any, options?: { nx?: boolean; ex?: number }): Promise<any>;
    incr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<number>;
  }
}

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
  
  // EgressClient for HLS/Recording egress
  export class EgressClient {
    constructor(url: string, apiKey: string, apiSecret: string);
    startRoomCompositeEgress(
      roomName: string,
      options: {
        segments?: {
          protocol?: number;
          filenamePrefix?: string;
          playlistName?: string;
          segmentDuration?: number;
          s3?: {
            accessKey: string;
            secret: string;
            bucket: string;
            endpoint?: string;
            region?: string;
          };
        };
      },
      egressOptions?: {
        layout?: string;
        audioOnly?: boolean;
        videoOnly?: boolean;
      }
    ): Promise<{ egressId: string }>;
  }

  // RoomServiceClient for room management
  export class RoomServiceClient {
    constructor(url: string, apiKey: string, apiSecret: string);
    createRoom(room: { name: string; emptyTimeout?: number; metadata?: string }): Promise<{ name: string }>;
    deleteRoom(roomName: string): Promise<void>;
    listRooms(): Promise<{ name: string; numParticipants: number }[]>;
    getRoom(roomName: string): Promise<{ name: string; metadata?: string }>;
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

declare module 'https://cdn.skypack.dev/stripe@14.25.0?min' {
  const Stripe: any
  export default Stripe
}

declare module 'jsr:@supabase/functions-js/edge-runtime.d.ts' {}
