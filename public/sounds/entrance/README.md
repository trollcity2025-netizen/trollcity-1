# Role-Based Entrance Effect Sounds

This directory contains sound effects for the role-based entrance animations.

## Required Sound Files

### Admin Entrance Effect (`divine_bass.mp3`)
- **Description**: Deep bass impact with metallic overtones
- **Duration**: 2-3 seconds
- **Characteristics**: Powerful, overwhelming, god-like presence
- **Suggested**: Heavy bass drop + metallic chimes + low frequency rumble

### Lead Troll Officer Entrance Effect (`elite_command.mp3`)
- **Description**: Prestigious, commanding sound
- **Duration**: 1.5-2 seconds
- **Characteristics**: Authoritative but refined, elite status
- **Suggested**: Orchestral swell + subtle brass fanfare + controlled percussion

### Troll Officer Entrance Effect (`police_siren.mp3`)
- **Description**: Police-style siren with authority
- **Duration**: 1-2 seconds
- **Characteristics**: Urgent, official, law enforcement vibe
- **Suggested**: Classic police siren sweep + radio crackle + authoritative tone

## File Format Requirements
- **Format**: MP3
- **Sample Rate**: 44.1kHz
- **Bit Rate**: 128kbps or higher
- **Channels**: Stereo
- **Volume**: Normalized to -6dBFS

## Implementation Notes
- Sounds are played via HTML5 Audio API
- Volume is set to 60% by default
- Error handling is included for missing files
- Sounds play automatically on role-based entrance effects