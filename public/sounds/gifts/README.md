# Gift Sound Effects

This folder should contain gift sound effect audio files for different gift tiers.

## Required Files

| File | Tier | Threshold |
|------|------|-----------|
| common.mp3 | Common | < 500 coins |
| rare.mp3 | Rare | ≥ 500 coins |
| epic.mp3 | Epic | ≥ 2500 coins |
| legendary.mp3 | Legendary | ≥ 10000 coins |

## Audio Requirements

- Format: MP3
- Duration: 1-3 seconds
- Volume: Should be balanced for typical playback at 70% volume
- Style: Short, celebratory sound effects

## Notes

- The gift system will gracefully handle missing sound files (no crash)
- If files are missing, only visual effects will play
- Sound effects use the Web Audio API with automatic fallbacks
