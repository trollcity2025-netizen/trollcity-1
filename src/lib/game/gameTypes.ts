// Central game types to avoid circular dependencies

export type GameType =
  | 'two-truths-lie'
  | 'fame-shame-wheel'
  | 'troll-identity-hunt'
  | 'reaction-speed'
  | 'multiplayer-solitaire'
  | 'multiplayer-dominoes'
  | 'snake'
  | 'pong'
  | 'tetris';

export type PageTab = 'games' | 'giveaways';
