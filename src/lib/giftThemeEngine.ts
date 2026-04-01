/**
 * Gift Theme Animation Engine
 * 
 * Maps gift names/icons to unique themed animations.
 * Each gift type gets its own distinct visual behavior.
 */

export type GiftTheme =
  | 'fire' | 'money' | 'heart' | 'crown' | 'diamond' | 'champagne'
  | 'car' | 'rocket' | 'dragon' | 'flower' | 'star' | 'trophy'
  | 'music' | 'lightning' | 'skull' | 'pizza' | 'wine' | 'beer'
  | 'coffee' | 'cigarette' | 'police' | 'helicopter' | 'bomb'
  | 'rainbow' | 'snow' | 'ocean' | 'camera' | 'mic' | 'gun'
  | 'knife' | 'shield' | 'sword' | 'gem' | 'gold' | 'silver'
  | 'rose' | 'kiss' | 'hug' | 'laugh' | 'cry' | 'angry'
  | 'cool' | 'wow' | 'devil' | 'angel' | 'ghost' | 'alien'
  | 'ufo' | 'planet' | 'moon' | 'sun' | 'earth' | 'airplane'
  | 'boat' | 'train' | 'house' | 'castle' | 'church' | 'tent'
  | 'flag' | 'balloon' | 'gift' | 'box' | 'ring' | 'clock'
  | 'watch' | 'phone' | 'computer' | 'game' | 'dice' | 'cards'
  | 'slot' | 'wheel' | 'hammer' | 'wrench' | 'key' | 'lock'
  | 'candle' | 'spark' | 'smoke' | 'wave' | 'tornado' | 'volcano'
  | 'default';

// Keywords mapped to themes - order matters (more specific first)
const THEME_KEYWORDS: Array<[string[], GiftTheme]> = [
  // Fire & heat
  [['fire', 'flame', 'blaze', 'burn', 'inferno', 'heat', 'torch', 'volcano', 'magma'], 'fire'],
  
  // Money & wealth
  [['cash', 'money', 'dollar', 'bills', 'rich', 'wealth', 'bank', 'stash', 'rain money', 'money rain'], 'money'],
  [['coin', 'flip coin', 'gold coin', 'coins'], 'gold'],
  [['gold bar', 'gold rush', 'golden'], 'gold'],
  [['silver', 'platinum'], 'silver'],
  
  // Heart & love
  [['heart', 'love', 'pulse', 'heartbeat'], 'heart'],
  [['kiss', 'smooch', 'mwah'], 'kiss'],
  [['hug', 'embrace', 'cuddle'], 'hug'],
  [['rose', 'roses', 'flower rose'], 'rose'],
  [['flower', 'bloom', 'bouquet', 'petal'], 'flower'],
  
  // Royal & crown
  [['crown', 'king', 'queen', 'royal', 'majesty', 'throne', 'scepter', 'emperor'], 'crown'],
  
  // Gems & diamonds
  [['diamond', 'ice', 'bling', 'sparkle'], 'diamond'],
  [['gem', 'ruby', 'emerald', 'sapphire', 'crystal', 'jewel'], 'gem'],
  
  // Drinks
  [['champagne', 'bubbly', 'pop bottle', 'toast'], 'champagne'],
  [['wine', 'red wine', 'wine bottle', 'grape'], 'wine'],
  [['beer', 'brew', 'lager', 'pint', 'ale'], 'beer'],
  [['coffee', 'espresso', 'latte', 'cafe', 'tea'], 'coffee'],
  
  // Food
  [['pizza', 'slice', 'pepperoni'], 'pizza'],
  
  // Vehicles
  [['car', 'auto', 'vehicle', 'drift', 'race', 'speed', 'motor'], 'car'],
  [['helicopter', 'chopper', 'heli'], 'helicopter'],
  [['rocket', 'launch', 'space', 'shuttle', 'mars'], 'rocket'],
  [['airplane', 'plane', 'jet', 'fly', 'flight'], 'airplane'],
  [['boat', 'ship', 'yacht', 'sail', 'cruise'], 'boat'],
  [['train', 'rail', 'locomotive'], 'train'],
  
  // Animals & creatures
  [['dragon', 'breath fire', 'wyvern'], 'dragon'],
  [['skull', 'death', 'dead', 'skeleton', 'bones'], 'skull'],
  [['ghost', 'haunt', 'spook', 'phantom'], 'ghost'],
  [['alien', 'ufo', 'extraterrestrial'], 'alien'],
  [['devil', 'demon', 'evil', 'satan'], 'devil'],
  [['angel', 'halo', 'heaven', 'divine'], 'angel'],
  
  // Weather & nature
  [['rainbow', 'colorful', 'prism'], 'rainbow'],
  [['snow', 'ice', 'blizzard', 'frost', 'cold', 'winter'], 'snow'],
  [['ocean', 'wave', 'sea', 'water', 'tsunami', 'surf'], 'ocean'],
  [['tornado', 'cyclone', 'hurricane', 'storm', 'whirlwind'], 'tornado'],
  [['volcano', 'eruption', 'lava'], 'volcano'],
  [['sun', 'solar', 'sunshine', 'sunny'], 'sun'],
  [['moon', 'lunar', 'crescent'], 'moon'],
  [['star', 'shooting star', 'constellation', 'galaxy', 'cosmos', 'planet'], 'star'],
  [['earth', 'world', 'globe'], 'earth'],
  
  // Entertainment
  [['music', 'song', 'melody', 'tune', 'beat', 'rhythm'], 'music'],
  [['mic', 'microphone', 'rap', 'sing', 'vocal'], 'mic'],
  [['camera', 'photo', 'flash', 'snap', 'selfie', 'pic'], 'camera'],
  [['game', 'gaming', 'play', 'controller', 'joystick'], 'game'],
  [['dice', 'roll', 'gamble'], 'dice'],
  [['card', 'poker', 'blackjack', 'deck'], 'cards'],
  [['slot', 'jackpot', 'casino'], 'slot'],
  
  // Weapons & tools
  [['gun', 'shoot', 'bullet', 'pistol', 'rifle', 'ak47', 'ammo'], 'gun'],
  [['knife', 'stab', 'blade', 'sword', 'katana', 'cut'], 'sword'],
  [['shield', 'armor', 'defense', 'protect'], 'shield'],
  [['hammer', 'smash', 'crush', 'pound'], 'hammer'],
  [['bomb', 'explode', 'dynamite', 'tnt', 'nuke', 'explosive'], 'bomb'],
  [['wrench', 'fix', 'repair', 'tool'], 'wrench'],
  
  // Status & emotions
  [['trophy', 'award', 'medal', 'champion', 'winner', 'victory', 'first place'], 'trophy'],
  [['cool', 'sunglasses', 'swag', 'drip', 'fresh'], 'cool'],
  [['laugh', 'lol', 'haha', 'funny', 'comedy', 'joke'], 'laugh'],
  [['cry', 'sad', 'tears', 'sob', 'weep'], 'cry'],
  [['angry', 'rage', 'fury', 'mad', 'frustrated'], 'angry'],
  [['wow', 'omg', 'shock', 'surprise', 'amazed'], 'wow'],
  
  // Objects
  [['balloon', 'float', 'party'], 'balloon'],
  [['gift', 'present', 'box', 'surprise gift', 'mystery'], 'gift'],
  [['ring', 'engagement', 'wedding', 'marry'], 'ring'],
  [['clock', 'time', 'watch', 'hour'], 'clock'],
  [['phone', 'mobile', 'call', 'text'], 'phone'],
  [['computer', 'pc', 'laptop', 'screen'], 'computer'],
  [['flag', 'banner', 'pennant'], 'flag'],
  [['key', 'unlock', 'access'], 'key'],
  [['lock', 'secure', 'vault', 'safe'], 'lock'],
  [['candle', 'wick', 'flame candle'], 'candle'],
  [['spark', 'electric', 'zap', 'shock'], 'spark'],
  [['smoke', 'fog', 'mist', 'cloud'], 'smoke'],
  
  // Buildings
  [['house', 'home', 'mansion', 'villa'], 'house'],
  [['castle', 'fortress', 'palace'], 'castle'],
  
  // Smoking
  [['cigarette', 'smoke cig', 'blunt', 'joint', 'weed', 'vape', 'nic'], 'cigarette'],
  
  // Police
  [['police', 'cop', 'siren', 'arrest', 'law', 'badge', 'officer'], 'police'],
  
  // Wheel
  [['wheel', 'spin', 'fortune', 'lucky'], 'wheel'],
];

/**
 * Detect the animation theme for a gift based on its name and icon
 */
export function detectGiftTheme(name: string, icon?: string): GiftTheme {
  const searchText = `${name} ${icon || ''}`.toLowerCase().replace(/[_-]/g, ' ');
  
  for (const [keywords, theme] of THEME_KEYWORDS) {
    for (const keyword of keywords) {
      if (searchText.includes(keyword)) {
        return theme;
      }
    }
  }
  
  return 'default';
}

/**
 * Get the themed particle emoji for a gift
 */
export function getThemeParticleEmojis(theme: GiftTheme): string[] {
  switch (theme) {
    case 'fire': return ['🔥', '🔥', '💥', '✨', '🌋'];
    case 'money': return ['💵', '💰', '💸', '🪙', '💎'];
    case 'gold': return ['🪙', '💰', '✨', '⭐', '💫'];
    case 'silver': return ['🪙', '✨', '💎', '💫', '⭐'];
    case 'heart': return ['❤️', '💖', '💕', '💗', '💓'];
    case 'kiss': return ['💋', '😘', '❤️', '💖', '💕'];
    case 'hug': return ['🤗', '💕', '💖', '💗', '💛'];
    case 'rose': return ['🌹', '🌹', '🥀', '💮', '🌸'];
    case 'flower': return ['🌸', '🌺', '🌻', '🌷', '🌼'];
    case 'crown': return ['👑', '👑', '✨', '💫', '⭐'];
    case 'diamond': return ['💎', '💎', '✨', '💠', '🔷'];
    case 'gem': return ['💎', '💠', '🔮', '✨', '💫'];
    case 'champagne': return ['🍾', '🥂', '✨', '💫', '🫧'];
    case 'wine': return ['🍷', '🍇', '🍷', '✨', '🫧'];
    case 'beer': return ['🍺', '🍻', '🍺', '🫧', '✨'];
    case 'coffee': return ['☕', '☕', '💨', '✨', '🫧'];
    case 'pizza': return ['🍕', '🍕', '🧀', '🍅', '✨'];
    case 'car': return ['🚗', '🏎️', '💨', '🔥', '✨'];
    case 'helicopter': return ['🚁', '🚁', '💨', '✨', '💫'];
    case 'rocket': return ['🚀', '🔥', '💨', '✨', '⭐'];
    case 'airplane': return ['✈️', '✈️', '💨', '☁️', '✨'];
    case 'boat': return ['⛵', '🚢', '🌊', '💨', '✨'];
    case 'train': return ['🚂', '🚃', '💨', '✨', '🔥'];
    case 'dragon': return ['🐉', '🔥', '💥', '✨', '👹'];
    case 'skull': return ['💀', '☠️', '⚰️', '🖤', '👻'];
    case 'ghost': return ['👻', '👻', '💀', '🌫️', '✨'];
    case 'alien': return ['👽', '🛸', '✨', '💫', '🌟'];
    case 'devil': return ['😈', '🔥', '👿', '💀', '🖤'];
    case 'angel': return ['😇', '✨', '⭐', '💫', '🌟'];
    case 'rainbow': return ['🌈', '🌈', '✨', '💫', '⭐'];
    case 'snow': return ['❄️', '⛄', '🌨️', '✨', '💎'];
    case 'ocean': return ['🌊', '🌊', '💧', '🐚', '✨'];
    case 'tornado': return ['🌪️', '🌪️', '💨', '💨', '⚡'];
    case 'volcano': return ['🌋', '🔥', '💥', '🪨', '✨'];
    case 'sun': return ['☀️', '🌞', '✨', '💫', '⭐'];
    case 'moon': return ['🌙', '🌕', '⭐', '✨', '💫'];
    case 'star': return ['⭐', '🌟', '✨', '💫', '🌠'];
    case 'earth': return ['🌍', '🌎', '🌏', '✨', '💫'];
    case 'music': return ['🎵', '🎶', '🎵', '🎼', '✨'];
    case 'mic': return ['🎤', '🎤', '🎵', '🎶', '✨'];
    case 'camera': return ['📸', '📷', '✨', '💫', '🔦'];
    case 'game': return ['🎮', '🕹️', '👾', '✨', '💥'];
    case 'dice': return ['🎲', '🎲', '🎰', '✨', '💫'];
    case 'cards': return ['🃏', '🎴', '♠️', '✨', '💫'];
    case 'slot': return ['🎰', '🎰', '💰', '✨', '💫'];
    case 'gun': return ['🔫', '💥', '💨', '🔥', '✨'];
    case 'sword': return ['⚔️', '🗡️', '💥', '✨', '🔥'];
    case 'shield': return ['🛡️', '🛡️', '✨', '💫', '⭐'];
    case 'hammer': return ['🔨', '💥', '🔨', '✨', '💫'];
    case 'bomb': return ['💣', '💥', '🔥', '💨', '✨'];
    case 'trophy': return ['🏆', '🏆', '✨', '⭐', '💫'];
    case 'cool': return ['😎', '🕶️', '✨', '💫', '⭐'];
    case 'laugh': return ['😂', '🤣', '😆', '✨', '💫'];
    case 'cry': return ['😢', '💧', '😭', '💦', '✨'];
    case 'angry': return ['😤', '💢', '🔥', '😡', '💥'];
    case 'wow': return ['😮', '😲', '🤯', '✨', '💫'];
    case 'balloon': return ['🎈', '🎈', '🎉', '🎊', '✨'];
    case 'gift': return ['🎁', '🎁', '🎀', '✨', '💫'];
    case 'ring': return ['💍', '💍', '✨', '💎', '💫'];
    case 'clock': return ['⏰', '🕐', '✨', '💫', '⚙️'];
    case 'phone': return ['📱', '📱', '📞', '✨', '💫'];
    case 'computer': return ['💻', '🖥️', '✨', '💫', '⚡'];
    case 'flag': return ['🚩', '🏁', '🏳️', '✨', '💫'];
    case 'key': return ['🔑', '🔑', '✨', '💫', '🔒'];
    case 'lock': return ['🔒', '🔐', '✨', '💫', '🔑'];
    case 'candle': return ['🕯️', '🕯️', '✨', '🔥', '💫'];
    case 'spark': return ['⚡', '✨', '💥', '💫', '🌟'];
    case 'smoke': return ['💨', '🌫️', '☁️', '✨', '💫'];
    case 'house': return ['🏠', '🏡', '✨', '💫', '⭐'];
    case 'castle': return ['🏰', '🏰', '✨', '👑', '💫'];
    case 'cigarette': return ['🚬', '💨', '🌫️', '✨', '☁️'];
    case 'police': return ['🚨', '🚔', '🚨', '✨', '💫'];
    case 'wheel': return ['🎡', '🔄', '✨', '💫', '🎰'];
    case 'wrench': return ['🔧', '🔧', '⚙️', '✨', '💫'];
    default: return ['✨', '💫', '⭐', '🌟', '🎉'];
  }
}

/**
 * Get the background color for a theme
 */
export function getThemeColor(theme: GiftTheme): string {
  switch (theme) {
    case 'fire': return '#ff4500';
    case 'money': case 'gold': return '#ffd700';
    case 'silver': return '#c0c0c0';
    case 'heart': case 'kiss': case 'rose': return '#ff1493';
    case 'hug': return '#ffb347';
    case 'crown': return '#ffd700';
    case 'diamond': return '#00e5ff';
    case 'gem': return '#e040fb';
    case 'champagne': return '#f5e642';
    case 'wine': return '#722f37';
    case 'beer': return '#f28e1c';
    case 'coffee': return '#6f4e37';
    case 'pizza': return '#ff6347';
    case 'car': return '#ff3b3b';
    case 'helicopter': return '#4caf50';
    case 'rocket': return '#ff5722';
    case 'airplane': return '#2196f3';
    case 'boat': return '#0288d1';
    case 'train': return '#795548';
    case 'dragon': return '#ff0000';
    case 'skull': return '#616161';
    case 'ghost': return '#b0bec5';
    case 'alien': case 'ufo': return '#76ff03';
    case 'devil': return '#b71c1c';
    case 'angel': return '#fff9c4';
    case 'rainbow': return '#e91e63';
    case 'snow': return '#e3f2fd';
    case 'ocean': return '#00bcd4';
    case 'tornado': return '#78909c';
    case 'volcano': return '#ff5722';
    case 'sun': return '#ffeb3b';
    case 'moon': return '#9fa8da';
    case 'star': return '#ffc107';
    case 'earth': return '#4caf50';
    case 'music': case 'mic': return '#e91e63';
    case 'camera': return '#ffffff';
    case 'game': return '#9c27b0';
    case 'dice': case 'cards': case 'slot': return '#4caf50';
    case 'gun': return '#f44336';
    case 'sword': return '#9e9e9e';
    case 'shield': return '#2196f3';
    case 'hammer': return '#ff9800';
    case 'bomb': return '#ff5722';
    case 'trophy': return '#ffd700';
    case 'cool': return '#00e5ff';
    case 'laugh': return '#ffeb3b';
    case 'cry': return '#42a5f5';
    case 'angry': return '#f44336';
    case 'wow': return '#ff9800';
    case 'balloon': return '#e91e63';
    case 'gift': return '#ff4081';
    case 'ring': return '#e0e0e0';
    case 'clock': return '#607d8b';
    case 'phone': return '#2196f3';
    case 'computer': return '#455a64';
    case 'flag': return '#f44336';
    case 'key': return '#ffd700';
    case 'lock': return '#795548';
    case 'candle': return '#ff9800';
    case 'spark': return '#ffeb3b';
    case 'smoke': return '#9e9e9e';
    case 'house': case 'castle': return '#8bc34a';
    case 'cigarette': return '#9e9e9e';
    case 'police': return '#1565c0';
    case 'wheel': return '#e91e63';
    case 'wrench': return '#607d8b';
    case 'flower': return '#e91e63';
    default: return '#a855f7';
  }
}

/**
 * Get animation type based on theme
 */
export function getThemeAnimationType(theme: GiftTheme): string {
  switch (theme) {
    case 'fire': return 'fire-rise';
    case 'money': case 'gold': case 'silver': return 'money-rain';
    case 'heart': case 'kiss': case 'hug': return 'heartbeat';
    case 'rose': case 'flower': return 'petal-fall';
    case 'crown': return 'crown-float';
    case 'diamond': case 'gem': return 'sparkle-burst';
    case 'champagne': return 'spray';
    case 'wine': case 'beer': case 'coffee': return 'pour';
    case 'pizza': return 'spin-in';
    case 'car': return 'drive-across';
    case 'helicopter': return 'fly-across';
    case 'rocket': return 'launch-up';
    case 'airplane': return 'fly-across';
    case 'boat': return 'sail-across';
    case 'train': return 'drive-across';
    case 'dragon': return 'dragon-swoop';
    case 'skull': return 'skull-rise';
    case 'ghost': return 'ghost-float';
    case 'alien': case 'ufo': return 'ufo-abduct';
    case 'devil': return 'hell-rise';
    case 'angel': return 'descend';
    case 'rainbow': return 'rainbow-arc';
    case 'snow': return 'snow-fall';
    case 'ocean': return 'wave-crash';
    case 'tornado': return 'spiral-up';
    case 'volcano': return 'erupt';
    case 'sun': return 'sun-burst';
    case 'moon': return 'moon-rise';
    case 'star': return 'star-rain';
    case 'earth': return 'earth-spin';
    case 'music': case 'mic': return 'note-float';
    case 'camera': return 'flash-burst';
    case 'game': case 'dice': case 'cards': case 'slot': return 'game-pop';
    case 'gun': return 'bullet-burst';
    case 'sword': return 'slash';
    case 'shield': return 'shield-expand';
    case 'hammer': return 'smash-down';
    case 'bomb': return 'explode';
    case 'trophy': return 'trophy-reveal';
    case 'cool': case 'laugh': case 'wow': return 'emoji-pop';
    case 'cry': return 'tear-fall';
    case 'angry': return 'shake-burst';
    case 'balloon': return 'balloon-rise';
    case 'gift': case 'box': return 'unbox';
    case 'ring': return 'ring-glow';
    case 'clock': return 'clock-spin';
    case 'phone': case 'computer': return 'screen-flash';
    case 'flag': return 'flag-wave';
    case 'key': return 'key-turn';
    case 'lock': return 'lock-shake';
    case 'candle': return 'candle-flicker';
    case 'spark': return 'spark-zap';
    case 'smoke': return 'smoke-rise';
    case 'house': case 'castle': return 'build-up';
    case 'cigarette': return 'smoke-puff';
    case 'police': return 'siren-flash';
    case 'wheel': return 'wheel-spin';
    case 'wrench': return 'wrench-turn';
    default: return 'default-burst';
  }
}
