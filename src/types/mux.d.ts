// Type declarations for Mux custom elements

declare namespace JSX {
  interface IntrinsicElements {
    'mux-player': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'playback-id'?: string;
        'stream-type'?: 'on-demand' | 'live' | 'recorded';
        'metadata'?: {
          video_title?: string;
          video_id?: string;
          viewer_user_id?: string;
          [key: string]: string | undefined;
        };
        'primary-color'?: string;
        'secondary-color'?: string;
        'accent-color'?: string;
        'muted'?: boolean;
        'autoplay'?: boolean;
        'loop'?: boolean;
        'poster'?: string;
        'crossorigin'?: string;
        'preload'?: 'none' | 'metadata' | 'auto';
        'controls'?: boolean;
        [key: string]: unknown;
      },
      HTMLElement
    >;
    'mux-audio': React.DetailedHTMLProps<
      React.HTMLAttributes<HTMLElement> & {
        'playback-id'?: string;
        'stream-type'?: 'on-demand' | 'live' | 'recorded';
        'metadata'?: {
          audio_title?: string;
          audio_id?: string;
          [key: string]: string | undefined;
        };
        'muted'?: boolean;
        'autoplay'?: boolean;
        'loop'?: boolean;
        'crossorigin'?: string;
        'preload'?: 'none' | 'metadata' | 'auto';
        [key: string]: unknown;
      },
      HTMLElement
    >;
  }
}

// Extend HTMLElement for mux-player custom element
interface MuxPlayerElement extends HTMLElement {
  playbackId?: string;
  streamType?: 'on-demand' | 'live' | 'recorded';
  metadata?: Record<string, string>;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  muted?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  poster?: string;
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'mux-player': MuxPlayerElement;
    'mux-audio': MuxPlayerElement;
  }
}

export {};
