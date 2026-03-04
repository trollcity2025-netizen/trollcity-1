/**
 * Troll City Safety Keyword Detection System
 * 
 * This file contains all safety-related keyword categories and detection logic.
 * These keywords are used ONLY for backend safety monitoring and are NEVER
 * displayed to users.
 */

import type { KeywordCategory, DetectedKeyword, SafetyTriggerType, AlertLevel } from '@/types/safety';

// ============================================================
// SELF HARM KEYWORDS
// ============================================================

const SELF_HARM_KEYWORDS: string[] = [
  'kill myself',
  'suicide',
  'end my life',
  'i want to die',
  'hurt myself',
  'cut myself',
  'overdose',
  'self harm',
  'self-harm',
  'ending it all',
  'better off dead',
  'no reason to live',
  "can't go on",
  'want to end it',
  'thinking about hurting',
  'harm myself',
  'slit my wrists',
  'jump off',
  'kill myself tonight',
  'planning to die',
  'goodbye forever',
  "won't be here tomorrow",
  'final message',
  'suicide note',
  'ending everything',
  'cant take it anymore',
  'make the pain stop',
  'end the suffering',
  'not worth living',
  'wish i was dead',
  'better off without me',
  "don't want to wake up",
  'never wake up',
  'eternal sleep',
  'permanent solution',
  'end the pain permanently',
  'going away forever',
  'last stream',
  'final stream'
];

// ============================================================
// THREAT KEYWORDS
// ============================================================

const THREAT_KEYWORDS: string[] = [
  'kill you',
  'shoot you',
  'stab you',
  'i will hurt you',
  'i will find you',
  'i will beat you',
  'coming for you',
  'watch your back',
  'you are dead',
  'youre dead',
  "you're dead",
  'going to hurt you',
  'make you pay',
  'get you for this',
  'revenge on you',
  'destroy you',
  'ruin your life',
  'make you suffer',
  'going to kill',
  'planning to hurt',
  'know where you live',
  'i know where',
  'find your address',
  'track you down',
  'hunt you down',
  'swat you',
  'send someone after',
  'put a hit on',
  'take you out',
  'eliminate you',
  'end you',
  'finish you off',
  'break your neck',
  'snap your neck',
  'beat you up',
  'jump you',
  'jumped you',
  'jump them',
  'drive by',
  'shoot up your',
  'burn your house',
  'kill your family',
  'hurt your family',
  'going after your'
];

// ============================================================
// VIOLENCE KEYWORDS
// ============================================================

const VIOLENCE_KEYWORDS: string[] = [
  'going to shoot',
  'going to stab',
  'going to kill',
  'mass shooting',
  'school shooting',
  'bomb threat',
  'explosive device',
  'terrorist attack',
  'active shooter',
  'hostage situation',
  'armed and dangerous',
  'weapon in my',
  'gun in my',
  'knife in my',
  'bomb in my',
  'arsenal of',
  'stockpiling weapons',
  'planning an attack',
  'radicalized',
  'incel rebellion',
  'day of retribution',
  'going postal',
  'violent fantasy',
  'torture you',
  'make you bleed',
  'blood everywhere',
  'going to die today',
  'not leaving alive',
  'taking people with me',
  'if i go down',
  'going out shooting',
  'death toll',
  'body count',
  'kill count',
  'massacre',
  'slaughter',
  'execute',
  'execution',
  'lynch',
  'burn them alive',
  'acid attack',
  'run people over',
  'plow into crowd',
  'ram my car'
];

// ============================================================
// ABUSE KEYWORDS
// ============================================================

const ABUSE_KEYWORDS: string[] = [
  'go kill yourself',
  'kys',
  'kill yourself',
  'i hope you die',
  'hope you get cancer',
  'hope you crash',
  'hope your family dies',
  'deserve to die',
  'should kill yourself',
  'why are you alive',
  'waste of oxygen',
  'no one would miss you',
  'world be better without',
  'do everyone a favor',
  'end your life',
  'commit suicide',
  'drink bleach',
  'hang yourself',
  'shoot yourself',
  'slit your wrists',
  'jump off a bridge',
  'jump off a building',
  'eat a bullet',
  'blow your brains out',
  'put a gun to your',
  'tie the noose',
  'unalive yourself',
  'unalive',
  'sewer slide',
  'final yeet',
  'permadeath',
  'reset your life',
  'respawn irl',
  'hope you get doxxed',
  'hope you get swatted',
  'swat this person',
  'someone should swat',
  'deserves to be swatted'
];

// ============================================================
// KEYWORD CATEGORIES
// ============================================================

export const KEYWORD_CATEGORIES: KeywordCategory[] = [
  {
    name: 'SELF_HARM',
    keywords: SELF_HARM_KEYWORDS,
    severity: 1,
    description: 'Language indicating potential self-harm or suicidal ideation'
  },
  {
    name: 'THREAT',
    keywords: THREAT_KEYWORDS,
    severity: 2,
    description: 'Direct threats of violence against specific individuals'
  },
  {
    name: 'VIOLENCE',
    keywords: VIOLENCE_KEYWORDS,
    severity: 3,
    description: 'Language indicating potential for mass violence or attacks'
  },
  {
    name: 'ABUSE',
    keywords: ABUSE_KEYWORDS,
    severity: 1,
    description: 'Abusive language encouraging self-harm or death'
  }
];

// ============================================================
// DETECTION FUNCTIONS
// ============================================================

/**
 * Normalize text for keyword matching
 * Removes punctuation, converts to lowercase, handles common obfuscations
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    // Remove punctuation except apostrophes (for contractions)
    .replace(/[^\w\s']/g, ' ')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim();
}

/**
 * Check if text contains any safety keywords
 * Returns array of detected keywords with their categories
 */
export function detectSafetyKeywords(text: string): DetectedKeyword[] {
  const normalizedText = normalizeText(text);
  const detected: DetectedKeyword[] = [];
  
  // Track which keywords we've already found to avoid duplicates
  const foundPositions = new Set<number>();
  
  for (const category of KEYWORD_CATEGORIES) {
    for (const keyword of category.keywords) {
      // Normalize the keyword for matching
      const normalizedKeyword = normalizeText(keyword);
      
      // Check for exact phrase match
      let position = normalizedText.indexOf(normalizedKeyword);
      
      while (position !== -1) {
        // Check if we haven't already found something at this position
        if (!foundPositions.has(position)) {
          detected.push({
            category: category.name,
            keyword: keyword,
            severity: category.severity as AlertLevel,
            position: position
          });
          
          foundPositions.add(position);
        }
        
        // Look for next occurrence
        position = normalizedText.indexOf(normalizedKeyword, position + 1);
      }
    }
  }
  
  // Sort by position in text
  return detected.sort((a, b) => a.position - b.position);
}

/**
 * Quick check if text contains any safety keywords
 * Use this for fast filtering before detailed analysis
 */
export function containsSafetyKeywords(text: string): boolean {
  const normalizedText = normalizeText(text);
  
  for (const category of KEYWORD_CATEGORIES) {
    for (const keyword of category.keywords) {
      if (normalizedText.includes(normalizeText(keyword))) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Get the highest severity level from detected keywords
 */
export function getHighestSeverity(detected: DetectedKeyword[]): AlertLevel {
  if (detected.length === 0) return 1;
  
  return Math.max(...detected.map(d => d.severity)) as AlertLevel;
}

/**
 * Get unique categories from detected keywords
 */
export function getDetectedCategories(detected: DetectedKeyword[]): SafetyTriggerType[] {
  const categories = new Set<SafetyTriggerType>();
  detected.forEach(d => categories.add(d.category));
  return Array.from(categories);
}

/**
 * Format detected keywords for logging (privacy-safe)
 * Only returns category and count, not the actual keywords
 */
export function formatDetectionSummary(detected: DetectedKeyword[]): string {
  const categories = getDetectedCategories(detected);
  return `Detected ${detected.length} keywords in categories: ${categories.join(', ')}`;
}

// ============================================================
// STREAM CONTEXT FILTERING
// ============================================================

/**
 * Check if a user role should be monitored
 * Only broadcasters and guest box participants are monitored
 */
export function shouldMonitorUserRole(role: string): boolean {
  const monitoredRoles = [
    'broadcaster',
    'guest',
    'participant',
    'battle_participant'
  ];
  
  return monitoredRoles.includes(role.toLowerCase());
}

/**
 * Check if a stream type should be monitored
 */
export function shouldMonitorStreamType(streamType: string): boolean {
  const monitoredTypes = [
    'live',
    'broadcast',
    'battle',
    'guest_box'
  ];
  
  return monitoredTypes.includes(streamType.toLowerCase());
}

// ============================================================
// PRIVACY FUNCTIONS
// ============================================================

/**
 * Sanitize transcript for storage
 * Only keeps trigger phrases, removes surrounding context
 */
export function sanitizeTranscript(transcript: string, detected: DetectedKeyword[]): string {
  if (detected.length === 0) return '';
  
  // Return only the trigger phrases, not the full transcript
  const phrases = detected.map(d => d.keyword);
  return phrases.join('; ');
}

/**
 * Check if a transcript should be kept or discarded
 * Returns true if transcript contains safety keywords and should trigger alert
 */
export function shouldKeepTranscript(transcript: string): boolean {
  return containsSafetyKeywords(transcript);
}
