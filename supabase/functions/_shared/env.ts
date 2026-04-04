// Environment helper for edge functions
// Provides a consistent way to get environment variables

export function getEnv(key: string): string | undefined {
  return Deno.env.get(key)
}

export function getRequiredEnv(key: string): string {
  const value = Deno.env.get(key)
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}