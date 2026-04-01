/**
 * QR code pairing system for Deck phone pairing.
 *
 * Responsibilities:
 *  - Generate cryptographically secure, URL-safe pairing tokens
 *  - Build deep-link URLs (https://maitrollcity.com/deck-pair)
 *  - Render scannable QR codes onto a canvas via the `qrcode` library
 *
 * @module deckQrCode
 */
import QRCode from 'qrcode';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HTTPS endpoint that handles deck pairing deep links. */
const PAIRING_ENDPOINT = 'https://maitrollcity.com/deck-pair';

/** Number of random bytes used when generating a pairing token (32 bytes → 43 base64url chars). */
const TOKEN_BYTE_LENGTH = 32;

/** QR error-correction level – "M" balances capacity and resilience. */
const QR_ERROR_CORRECTION: QRCode.QRCodeErrorCorrectionLevel = 'M';

/** Default quiet-zone modules around the QR code. */
const QR_MARGIN = 2;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options that control QR code rendering. */
export interface QrRenderOptions {
  /** Width/height of the rendered canvas in CSS pixels. @default 240 */
  size?: number;
  /** Foreground (dark module) colour. @default '#000000' */
  foreground?: string;
  /** Background (light module) colour. Use `'transparent'` for a transparent canvas. @default '#ffffff' */
  background?: string;
  /** Quiet-zone width in modules. @default 2 */
  margin?: number;
}

/** Successful result returned by {@link renderPairCode}. */
export interface RenderResult {
  success: true;
  canvas: HTMLCanvasElement;
}

/** Error result returned by {@link renderPairCode}. */
export interface RenderError {
  success: false;
  error: Error;
}

/** Discriminated union returned by {@link renderPairCode}. */
export type RenderResponse = RenderResult | RenderError;

// ---------------------------------------------------------------------------
// Token Generation
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically secure, URL-safe pairing token.
 *
 * Uses `crypto.getRandomValues` to produce `TOKEN_BYTE_LENGTH` random bytes,
 * then encodes them as base64url (RFC 4648 §5) so the result is safe for use
 * in URLs without additional percent-encoding.
 *
 * @param userId - The user identifier; the first 8 characters are used as a
 *                 human-readable prefix in the token.
 * @returns A token string in the form `TC-{userId_prefix}-{base64url}`.
 * @throws {Error} If `userId` is empty or not a string.
 *
 * @example
 * ```ts
 * const token = generatePairToken('usr_abc123');
 * // → "TC-usr_abc1-k7Gf2xRt..."
 * ```
 */
export function generatePairToken(userId: string): string {
  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('generatePairToken: userId must be a non-empty string');
  }

  const prefix = userId.slice(0, 8);

  const bytes = new Uint8Array(TOKEN_BYTE_LENGTH);
  crypto.getRandomValues(bytes);

  // base64url encoding: standard base64 with +→- /→_ and padding stripped
  const b64 = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `TC-${prefix}-${b64}`;
}

// ---------------------------------------------------------------------------
// URL Construction
// ---------------------------------------------------------------------------

/**
 * Builds the HTTPS URL that will be encoded into the QR code.
 *
 * The token value is percent-encoded so the URL is always well-formed,
 * regardless of the characters present in the token.
 *
 * @param token - A pairing token produced by {@link generatePairToken}.
 * @returns A fully-qualified deep-link URL string.
 * @throws {Error} If `token` is empty or not a string.
 *
 * @example
 * ```ts
 * const url = createPairUrl('TC-usr_abc1-k7Gf2xRt');
 * // → "https://maitrollcity.com/deck-pair?token=TC-usr_abc1-k7Gf2xRt"
 * ```
 */
export function createPairUrl(token: string): string {
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error('createPairUrl: token must be a non-empty string');
  }

  return `${PAIRING_ENDPOINT}?token=${encodeURIComponent(token)}`;
}

// ---------------------------------------------------------------------------
// QR Rendering
// ---------------------------------------------------------------------------

/**
 * Renders a QR code onto an existing `<canvas>` element.
 *
 * The function validates its inputs, applies safe colour defaults (black
 * modules on a white background), and returns a discriminated-result object
 * instead of silently swallowing errors.
 *
 * @param canvas - The target `<canvas>` element. Must be present in the DOM.
 * @param data   - The string to encode (typically a URL from {@link createPairUrl}).
 * @param options - Optional visual configuration.
 * @returns A {@link RenderResponse} indicating success or failure.
 *
 * @example
 * ```ts
 * const canvas = document.getElementById('qr') as HTMLCanvasElement;
 * const result = await renderPairCode(canvas, createPairUrl(token));
 * if (!result.success) {
 *   console.error('QR render failed:', result.error.message);
 * }
 * ```
 */
export async function renderPairCode(
  canvas: HTMLCanvasElement,
  data: string,
  options?: QrRenderOptions,
): Promise<RenderResponse> {
  // --- input validation ----------------------------------------------------
  if (!(canvas instanceof HTMLCanvasElement)) {
    return {
      success: false,
      error: new Error('renderPairCode: canvas must be an HTMLCanvasElement'),
    };
  }

  if (typeof data !== 'string' || data.length === 0) {
    return {
      success: false,
      error: new Error('renderPairCode: data must be a non-empty string'),
    };
  }

  // --- resolve options with safe defaults ----------------------------------
  const size = options?.size ?? 240;
  const fg = options?.foreground ?? '#000000';
  const rawBg = options?.background ?? '#ffffff';
  const margin = options?.margin ?? QR_MARGIN;

  // Transparent backgrounds are rendered as fully-transparent black (#00000000)
  // because the `qrcode` library expects a colour string for the light modules.
  const bg = rawBg === 'transparent' ? '#00000000' : rawBg;

  // --- render --------------------------------------------------------------
  try {
    await QRCode.toCanvas(canvas, data, {
      width: size,
      margin,
      color: {
        dark: fg,
        light: bg,
      },
      errorCorrectionLevel: QR_ERROR_CORRECTION,
    });

    return { success: true, canvas };
  } catch (err) {
    const error =
      err instanceof Error
        ? err
        : new Error(`renderPairCode: unknown error – ${String(err)}`);

    return { success: false, error };
  }
}

// ---------------------------------------------------------------------------
// Convenience: one-shot helper
// ---------------------------------------------------------------------------

/**
 * Generates a pairing token, builds the deep-link URL, and renders the QR
 * code onto the given canvas in a single call.
 *
 * @param canvas - Target `<canvas>` element.
 * @param userId - The user identifier forwarded to {@link generatePairToken}.
 * @param options - Optional QR visual overrides.
 * @returns An object containing the generated `token` and `url`, plus the
 *          {@link RenderResponse} from the canvas render.
 *
 * @example
 * ```ts
 * const { token, url, render } = await generateAndRenderPairCode(
 *   canvasElement,
 *   'usr_abc123',
 * );
 * ```
 */
export async function generateAndRenderPairCode(
  canvas: HTMLCanvasElement,
  userId: string,
  options?: QrRenderOptions,
): Promise<{ token: string; url: string; render: RenderResponse }> {
  const token = generatePairToken(userId);
  const url = createPairUrl(token);
  const render = await renderPairCode(canvas, url, options);

  return { token, url, render };
}
