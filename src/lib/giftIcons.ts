const GIFT_EMOJI_OVERRIDES: Record<string, string> = {
  "troll clap": "👏",
  "glow heart": "💖",
  "laughing mask": "🎭",
  "troll mic drop": "🎤",
  "troll confetti": "🎉",
  "crown blast": "👑",
  "diamond storm": "💎",
  "the big crown": "👑",
  sav: "🌸",
  vived: "💠",
  rose: "🌹",
  "golden maple leaf": "🍁",
  fireworks: "🎆",
  "mini troll bomb": "💣",
  "royal crown": "👑",
  "chaos gift": "💥",
  "heart rain": "💓",
  "surprise gift box": "🎁",
  "christmas tree": "🎄",
  "santa gift": "🎅",
  snowflake: "❄️",
  "fireworks pack": "🎇",
  champagne: "🥂",
  "party popper": "🥳",
  "rose bouquet": "🌹",
  "heart box": "💝",
  "chocolate box": "🍫",
  "pumpkin bomb": "🎃",
  ghost: "👻",
  "witch hat": "🪄",
  "troll respect": "🫡",
  "neon heart": "💗",
  "candy troll pop": "🍭",
  "mini troll": "🧸",
  "diamond troll": "💎",
  "royal crown drop": "👑",
  "crown": "👑",
  "mic support": "🎙️",
  "laugh riot": "😂",
  "savscratch": "😼",
}

const DEFAULT_GIFT_ICON = "🎁"

export function getGiftEmoji(icon?: string | null, name?: string | null): string {
  const cleanedIcon = icon?.trim()

  if (cleanedIcon) {
    // Return actual emoji/Unicode glyph if it contains non-ASCII characters
    if (/[^\x00-\x7f]/.test(cleanedIcon)) {
      return cleanedIcon
    }
  }

  const normalizedName = (name || "").trim().toLowerCase()

  if (normalizedName && GIFT_EMOJI_OVERRIDES[normalizedName]) {
    return GIFT_EMOJI_OVERRIDES[normalizedName]
  }

  if (cleanedIcon) {
    return cleanedIcon
  }

  return DEFAULT_GIFT_ICON
}
