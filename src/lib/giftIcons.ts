const GIFT_EMOJI_OVERRIDES: Record<string, string> = {
  "troll clap": "👏",
  "glow heart": "💗",
  "laughing mask": "😹",
  "troll mic drop": "🎤",
  "troll confetti": "🎉",
  "crown blast": "👑",
  "diamond storm": "💎",
  "the big crown": "🌟",
  rose: "🌹",
  "golden maple leaf": "🍁",
  fireworks: "🎆",
  "mini troll bomb": "💣",
  "royal crown": "👑",
  "chaos gift": "🔥",
  "heart rain": "🌧️",
  "surprise gift box": "🎁",
  "christmas tree": "🎄",
  "santa gift": "🎅",
  snowflake: "❄️",
  "fireworks pack": "🎇",
  champagne: "🍾",
  "party popper": "🎊",
  "rose bouquet": "💐",
  "heart box": "❤️",
  "chocolate box": "🍫",
  "pumpkin bomb": "🎃",
  ghost: "👻",
  "witch hat": "🎩",
  "troll respect": "🫡",
  "neon heart": "💖",
  "candy troll pop": "🍭",
  "mini troll": "👶",
  "diamond troll": "💎",
  "royal crown drop": "👑",
  crown: "👑",
  "mic support": "🎙️",
  "laugh riot": "😂",
}

const DEFAULT_GIFT_ICON = "🎁"
const EMOJI_REGEX = /\p{Extended_Pictographic}/u

export function getGiftEmoji(icon?: string | null, name?: string | null): string {
  const cleanedIcon = icon?.trim()
  const normalizedName = (name || "").trim().toLowerCase()

  if (normalizedName && GIFT_EMOJI_OVERRIDES[normalizedName]) {
    return GIFT_EMOJI_OVERRIDES[normalizedName]
  }

  if (cleanedIcon && EMOJI_REGEX.test(cleanedIcon)) {
    return cleanedIcon
  }

  return DEFAULT_GIFT_ICON
}
