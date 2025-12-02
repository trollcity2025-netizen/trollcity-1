// Translation utility using OpenAI API
// Translates messages to user's preferred language

interface TranslationOptions {
  targetLang?: string
  sourceLang?: string
}

/**
 * Translate a message to the target language using OpenAI
 * Falls back to original text if translation fails or language is 'en'
 */
export async function translateMessage(
  text: string,
  targetLang: string = 'en',
  options: TranslationOptions = {}
): Promise<string> {
  // No translation needed for English or if no target language
  if (!targetLang || targetLang === 'en' || !text?.trim()) {
    return text
  }

  // Get OpenAI API key from environment
  const apiKey = (import.meta as any).env?.VITE_OPENAI_API_KEY
  if (!apiKey) {
    console.warn('OpenAI API key not found, returning original text')
    return text
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Translate the following text to ${getLanguageName(targetLang)}. Preserve emojis, formatting, and special characters. Only return the translated text, nothing else.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('Translation API error:', errorData)
      return text // Fallback to original
    }

    const data = await response.json()
    const translated = data.choices?.[0]?.message?.content?.trim()

    if (translated && translated !== text) {
      return translated
    }

    return text // Fallback to original if translation is empty or same
  } catch (error: any) {
    console.error('Translation error:', error)
    return text // Fallback to original on error
  }
}

/**
 * Get language name from code
 */
function getLanguageName(code: string): string {
  const languages: Record<string, string> = {
    'en': 'English',
    'es': 'Spanish',
    'ar': 'Arabic',
    'fr': 'French',
    'fil': 'Filipino',
    'pt': 'Portuguese',
    'de': 'German',
    'it': 'Italian',
    'ja': 'Japanese',
    'ko': 'Korean',
    'zh': 'Chinese',
    'hi': 'Hindi',
    'ru': 'Russian',
    'tr': 'Turkish',
    'vi': 'Vietnamese',
  }
  return languages[code] || code
}

/**
 * Batch translate multiple messages
 * Useful for chat messages
 */
export async function translateMessages(
  messages: string[],
  targetLang: string = 'en'
): Promise<string[]> {
  if (!targetLang || targetLang === 'en') {
    return messages
  }

  // Translate in parallel (with rate limiting consideration)
  const translations = await Promise.all(
    messages.map(msg => translateMessage(msg, targetLang))
  )

  return translations
}

