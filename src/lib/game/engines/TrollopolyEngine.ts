// TrollopolyEngine.ts - Core game logic for Trollopoly 3D Board Game

import {
  InternetGameEngine,
  GameAction,
  InternetGameConfig,
} from '../InternetGameTypes';
import {
  TrollopolyGameState,
  TrollopolyPlayer,
  Property,
  Card,
  TROLLOPOLY_PROPERTIES,
  INITIAL_PLAYER_COINS,
  VEHICLE_COLORS,
  VehicleType,
  GameLogEntry,
} from '../types/TrollopolyTypes';

const CHANCE_CARDS: Card[] = [
  { id: 'ch1', type: 'chance', title: 'Advance to GO', description: 'Collect 200 coins as you pass!', action: { type: 'move_to', propertyId: 0 } },
  { id: 'ch2', type: 'chance', title: 'Go to Jail', description: 'Go directly to Jail. Do not pass GO.', action: { type: 'go_to_jail' } },
  { id: 'ch3', type: 'chance', title: 'Nearest Train Station', description: 'Advance to nearest train station. Pay double rent if owned.', action: { type: 'move_to_nearest', propertyType: 'transport' } },
  { id: 'ch4', type: 'chance', title: 'Speeding Fine', description: 'Pay 50 coins for speeding.', action: { type: 'pay', amount: 50, target: 'bank' } },
  { id: 'ch5', type: 'chance', title: 'Bank Dividend', description: 'Bank pays you 100 coins dividend.', action: { type: 'receive', amount: 100, from: 'bank' } },
  { id: 'ch6', type: 'chance', title: 'Go Back 3 Spaces', description: 'Move back 3 spaces.', action: { type: 'move_spaces', spaces: -3 } },
  { id: 'ch7', type: 'chance', title: 'Advance to Admin Mega Estate', description: 'If you pass GO, collect 200 coins.', action: { type: 'move_to', propertyId: 39 } },
  { id: 'ch8', type: 'chance', title: 'Get Out of Jail Free', description: 'Keep this card until needed.', action: { type: 'get_out_of_jail_free' } },
  { id: 'ch9', type: 'chance', title: 'Street Repairs', description: 'Pay 40 coins per house, 115 per hotel.', action: { type: 'repairs', houseCost: 40, hotelCost: 115 } },
  { id: 'ch10', type: 'chance', title: 'Pay Each Player', description: 'Pay 50 coins to each player.', action: { type: 'pay', amount: 50, target: 'players' } },
];

const COMMUNITY_CARDS: Card[] = [
  { id: 'cc1', type: 'community', title: 'Advance to GO', description: 'Collect 200 coins.', action: { type: 'move_to', propertyId: 0 } },
  { id: 'cc2', type: 'community', title: 'Bank Error', description: 'Bank error in your favor. Collect 200 coins.', action: { type: 'receive', amount: 200, from: 'bank' } },
  { id: 'cc3', type: 'community', title: 'Doctor Fee', description: 'Pay 50 coins for doctor visit.', action: { type: 'pay', amount: 50, target: 'bank' } },
  { id: 'cc4', type: 'community', title: 'From Sale of Stock', description: 'You inherit 100 coins.', action: { type: 'receive', amount: 100, from: 'bank' } },
  { id: 'cc5', type: 'community', title: 'Get Out of Jail Free', description: 'Keep this card until needed.', action: { type: 'get_out_of_jail_free' } },
  { id: 'cc6', type: 'community', title: 'Go to Jail', description: 'Go directly to Jail.', action: { type: 'go_to_jail' } },
  { id: 'cc7', type: 'community', title: 'Holiday Fund', description: 'Receive 25 coins.', action: { type: 'receive', amount: 25, from: 'bank' } },
  { id: 'cc8', type: 'community', title: 'Income Tax Refund', description: 'Collect 20 coins.', action: { type: 'receive', amount: 20, from: 'bank' } },
  { id: 'cc9', type: 'community', title: 'Birthday!', description: 'Collect 10 coins from each player.', action: { type: 'receive', amount: 10, from: 'players' } },
  { id: 'cc10', type: 'community', title: 'Life Insurance', description: 'Collect 100 coins.', action: { type: 'receive', amount: 100, from: 'bank' } },
];

export class TrollopolyEngine implements InternetGameEngine<TrollopolyGameState> {
  private config: InternetGameConfig = {
    id: 'trollopoly',
    name: 'Trollopoly',
    description: '3D Mini City Board Game! Buy properties, build your empire, bankrupt your opponents!',
    minPlayers: 2,
    maxPlayers: 4,
    supportsMultiplayer: true,
    gameDuration: 0,
  };

  getGameConfig(): InternetGameConfig {
    return this.config;
  }

  initializeGame(
    players: { id: string; username: string }[],
    matchId: string
  ): TrollopolyGameState {
    const vehicleTypes: VehicleType[] = ['sports_car', 'taxi', 'police_car', 'limousine'];
    
    const trollopolyPlayers: TrollopolyPlayer[] = players.map((p, index) => ({
      id: p.id,
      username: p.username,
      score: 0,
      isHost: index === 0,
      isConnected: true,
      position: 0,
      coins: INITIAL_PLAYER_COINS,
      properties: [],
      isInJail: false,
      jailTurns: 0,
      hasGetOutOfJailFree: false,
      isBankrupt: false,
      vehicleType: vehicleTypes[index % vehicleTypes.length],
      vehicleColor: VEHICLE_COLORS[index % VEHICLE_COLORS.length],
      cameraEnabled: true,
      microphoneEnabled: true,
      doublesCount: 0,
    }));

    const properties: Property[] = TROLLOPOLY_PROPERTIES.map(p => ({
      ...p,
      ownerId: undefined,
      houseCount: 0,
      hasHotel: false,
      isMortgaged: false,
    }));

    // Shuffle cards
    const shuffledChance = this.shuffleCards([...CHANCE_CARDS]);
    const shuffledCommunity = this.shuffleCards([...COMMUNITY_CARDS]);

    return {
      matchId,
      gameType: 'trollopoly',
      players: trollopolyPlayers,
      status: 'ready',
      timerRemaining: 5, // 5 second countdown
      phase: 'countdown',
      properties,
      currentPlayerIndex: 0,
      dice: {
        die1: 1,
        die2: 1,
        isRolling: false,
        animationProgress: 0,
      },
      cards: {
        chance: shuffledChance,
        community: shuffledCommunity,
        chanceIndex: 0,
        communityIndex: 0,
      },
      spectators: [],
      spectatorCount: 0,
      gameLog: [{
        id: this.generateId(),
        timestamp: Date.now(),
        type: 'system',
        message: `Game started with ${players.length} players`,
      }],
      freeParkingCoins: 0,
      turnCount: 0,
      startTime: Date.now(),
    };
  }

  private shuffleCards(cards: Card[]): Card[] {
    return cards.sort(() => Math.random() - 0.5);
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private addLogEntry(
    state: TrollopolyGameState,
    type: GameLogEntry['type'],
    message: string,
    playerId?: string,
    data?: any
  ): GameLogEntry {
    const entry: GameLogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      type,
      message,
      playerId,
      data,
    };
    state.gameLog.push(entry);
    if (state.gameLog.length > 50) {
      state.gameLog.shift();
    }
    return entry;
  }

  processAction(state: TrollopolyGameState, action: GameAction): TrollopolyGameState {
    const newState = { ...state };
    
    switch (action.type) {
      case 'start_game':
        return this.handleStartGame(newState);
      
      case 'roll_dice':
        return this.handleRollDice(newState, action.playerId);
      
      case 'move_complete':
        return this.handleMoveComplete(newState);
      
      case 'buy_property':
        return this.handleBuyProperty(newState, action.playerId);
      
      case 'auction_property':
        return this.handleAuctionProperty(newState, action.playerId);
      
      case 'pay_rent':
        return this.handlePayRent(newState, action.playerId);
      
      case 'draw_card_complete':
        return this.handleDrawCardComplete(newState);
      
      case 'pay_jail_fine':
        return this.handlePayJailFine(newState, action.playerId);
      
      case 'use_jail_card':
        return this.handleUseJailCard(newState, action.playerId);
      
      case 'try_jail_doubles':
        return this.handleTryJailDoubles(newState, action.playerId);
      
      case 'end_turn':
        return this.handleEndTurn(newState);
      
      case 'add_spectator':
        return this.handleAddSpectator(newState, action.payload);
      
      case 'remove_spectator':
        return this.handleRemoveSpectator(newState, action.payload);
      
      case 'join_queue':
        return this.handleJoinQueue(newState, action.payload);
      
      case 'leave_queue':
        return this.handleLeaveQueue(newState, action.payload);
      
      default:
        return state;
    }
  }

  private handleStartGame(state: TrollopolyGameState): TrollopolyGameState {
    if (state.phase === 'countdown') {
      return {
        ...state,
        phase: 'waiting_for_roll',
        status: 'active',
        timerRemaining: 0,
      };
    }
    return state;
  }

  private handleRollDice(state: TrollopolyGameState, playerId: string): TrollopolyGameState {
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex !== state.currentPlayerIndex) return state;
    if (state.phase !== 'waiting_for_roll') return state;

    // Roll dice
    const die1 = Math.floor(Math.random() * 6) + 1;
    const die2 = Math.floor(Math.random() * 6) + 1;
    const isDoubles = die1 === die2;
    const total = die1 + die2;

    const newState = { ...state };
    newState.dice = {
      die1,
      die2,
      isRolling: true,
      animationProgress: 0,
    };

    const currentPlayer = newState.players[playerIndex];
    currentPlayer.lastRoll = { die1, die2 };

    this.addLogEntry(
      newState,
      'roll',
      `${currentPlayer.username} rolled ${die1} + ${die2} = ${total}`,
      playerId,
      { die1, die2, total, isDoubles }
    );

    // Handle jail
    if (currentPlayer.isInJail) {
      if (isDoubles) {
        currentPlayer.isInJail = false;
        currentPlayer.jailTurns = 0;
        this.addLogEntry(newState, 'jail', `${currentPlayer.username} rolled doubles and escaped jail!`, playerId);
      } else {
        currentPlayer.jailTurns++;
        if (currentPlayer.jailTurns >= 3) {
          currentPlayer.isInJail = false;
          currentPlayer.jailTurns = 0;
          currentPlayer.coins -= 50;
          this.addLogEntry(newState, 'jail', `${currentPlayer.username} paid 50 coins to leave jail after 3 turns.`, playerId);
        } else {
          newState.phase = 'jail';
          this.addLogEntry(newState, 'jail', `${currentPlayer.username} is still in jail (turn ${currentPlayer.jailTurns}/3).`, playerId);
          return newState;
        }
      }
    }

    // Check for 3 doubles in a row (go to jail)
    if (isDoubles) {
      currentPlayer.doublesCount++;
      if (currentPlayer.doublesCount >= 3) {
        currentPlayer.isInJail = true;
        currentPlayer.doublesCount = 0;
        currentPlayer.position = 10; // Jail position
        this.addLogEntry(newState, 'jail', `${currentPlayer.username} rolled 3 doubles and went to jail!`, playerId);
        newState.phase = 'jail';
        return newState;
      }
    } else {
      currentPlayer.doublesCount = 0;
    }

    // Calculate new position
    let newPosition = currentPlayer.position + total;
    let passedGo = false;
    if (newPosition >= 40) {
      newPosition -= 40;
      passedGo = true;
    }

    currentPlayer.position = newPosition;

    if (passedGo) {
      currentPlayer.coins += 200;
      this.addLogEntry(newState, 'move', `${currentPlayer.username} passed GO and collected 200 coins!`, playerId);
    }

    this.addLogEntry(
      newState,
      'move',
      `${currentPlayer.username} moved to ${newState.properties[newPosition].name}`,
      playerId,
      { from: newState.players[playerIndex].position - total, to: newPosition }
    );

    newState.phase = 'moving';

    return newState;
  }

  private handleMoveComplete(state: TrollopolyGameState): TrollopolyGameState {
    const currentPlayer = state.players[state.currentPlayerIndex];
    const property = state.properties[currentPlayer.position];

    // Check special spaces
    if (property.type === 'special') {
      if (property.name === 'Go To Jail') {
        currentPlayer.isInJail = true;
        currentPlayer.position = 10;
        this.addLogEntry(state, 'jail', `${currentPlayer.username} landed on Go To Jail!`, currentPlayer.id);
        state.phase = 'jail';
        return state;
      }
      
      if (property.name === 'Income Tax') {
        const tax = Math.min(200, Math.floor(currentPlayer.coins * 0.1));
        currentPlayer.coins -= tax;
        state.freeParkingCoins += tax;
        this.addLogEntry(state, 'system', `${currentPlayer.username} paid ${tax} coins income tax.`, currentPlayer.id);
      }
      
      if (property.name === 'Luxury Tax') {
        currentPlayer.coins -= 100;
        state.freeParkingCoins += 100;
        this.addLogEntry(state, 'system', `${currentPlayer.username} paid 100 coins luxury tax.`, currentPlayer.id);
      }
      
      if (property.name.includes('Chance') || property.name.includes('Community')) {
        state.phase = 'card_draw';
        return state;
      }
    }

    // Check property ownership
    if (property.ownerId && property.ownerId !== currentPlayer.id) {
      if (!property.isMortgaged) {
        state.phase = 'property_action';
        return state;
      }
    }

    // Unowned property that can be bought
    if (!property.ownerId && property.price > 0 && property.type !== 'utility' && property.type !== 'transport') {
      state.phase = 'property_action';
      return state;
    }

    // If doubles, roll again
    if (currentPlayer.lastRoll && currentPlayer.lastRoll.die1 === currentPlayer.lastRoll.die2 && !currentPlayer.isInJail) {
      state.phase = 'waiting_for_roll';
    } else {
      state.phase = 'waiting_for_roll';
      state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
      state.turnCount++;
    }

    return state;
  }

  private handleBuyProperty(state: TrollopolyGameState, playerId: string): TrollopolyGameState {
    const currentPlayer = state.players[state.currentPlayerIndex];
    const property = state.properties[currentPlayer.position];

    if (property.ownerId || property.price === 0) return state;
    if (currentPlayer.coins < property.price) return state;

    currentPlayer.coins -= property.price;
    property.ownerId = currentPlayer.id;
    currentPlayer.properties.push(property.id);

    this.addLogEntry(
      state,
      'purchase',
      `${currentPlayer.username} bought ${property.name} for ${property.price} coins!`,
      playerId,
      { propertyId: property.id, price: property.price }
    );

    // Check for monopoly
    this.checkMonopoly(state, currentPlayer, property);

    state.phase = 'waiting_for_roll';
    return state;
  }

  private checkMonopoly(state: TrollopolyGameState, player: TrollopolyPlayer, property: Property): void {
    const colorGroup = state.properties.filter(p => p.color === property.color);
    const ownedInGroup = colorGroup.filter(p => p.ownerId === player.id);
    
    if (ownedInGroup.length === colorGroup.length) {
      this.addLogEntry(state, 'system', `${player.username} completed the ${property.color} monopoly!`, player.id);
    }
  }

  private calculateRent(property: Property, state: TrollopolyGameState): number {
    if (property.type === 'utility') {
      // Rent is 4x dice roll for 1 utility, 10x for both
      const ownerUtilities = state.properties.filter(
        p => p.type === 'utility' && p.ownerId === property.ownerId
      ).length;
      // This would need the dice roll - simplified for now
      return ownerUtilities === 1 ? 28 : 70; // Average values
    }

    if (property.type === 'transport') {
      const ownerTransports = state.properties.filter(
        p => p.type === 'transport' && p.ownerId === property.ownerId
      ).length;
      return property.rents[ownerTransports - 1] || 25;
    }

    if (property.hasHotel) {
      return property.rents[5];
    }

    return property.rents[property.houseCount] || property.baseRent;
  }

  private handlePayRent(state: TrollopolyGameState, playerId: string): TrollopolyGameState {
    const currentPlayer = state.players[state.currentPlayerIndex];
    const property = state.properties[currentPlayer.position];

    if (!property.ownerId || property.ownerId === currentPlayer.id) return state;

    const rent = this.calculateRent(property, state);
    const owner = state.players.find(p => p.id === property.ownerId);

    if (!owner) return state;

    // Pay rent
    const actualRent = Math.min(rent, currentPlayer.coins);
    currentPlayer.coins -= actualRent;
    owner.coins += actualRent;

    this.addLogEntry(
      state,
      'rent',
      `${currentPlayer.username} paid ${actualRent} coins rent to ${owner.username} for ${property.name}`,
      playerId,
      { rent: actualRent, propertyId: property.id, ownerId: owner.id }
    );

    // Check bankruptcy
    if (currentPlayer.coins <= 0) {
      currentPlayer.isBankrupt = true;
      this.addLogEntry(state, 'bankrupt', `${currentPlayer.username} is bankrupt!`, currentPlayer.id);
    }

    state.phase = 'waiting_for_roll';
    return state;
  }

  private handleDrawCardComplete(state: TrollopolyGameState): TrollopolyGameState {
    const currentPlayer = state.players[state.currentPlayerIndex];
    const property = state.properties[currentPlayer.position];
    
    let card: Card;
    if (property.name.includes('Chance')) {
      card = state.cards.chance[state.cards.chanceIndex];
      state.cards.chanceIndex = (state.cards.chanceIndex + 1) % state.cards.chance.length;
    } else {
      card = state.cards.community[state.cards.communityIndex];
      state.cards.communityIndex = (state.cards.communityIndex + 1) % state.cards.community.length;
    }

    state.activeCard = card;

    // Execute card action
    this.executeCardAction(state, card, currentPlayer);

    state.phase = 'waiting_for_roll';
    return state;
  }

  private executeCardAction(state: TrollopolyGameState, card: Card, player: TrollopolyPlayer): void {
    this.addLogEntry(state, 'card', `${player.username} drew: ${card.title} - ${card.description}`, player.id);

    switch (card.action.type) {
      case 'move_to': {
        const oldPos = player.position;
        player.position = card.action.propertyId;
        if (player.position < oldPos) {
          player.coins += 200; // Passed GO
        }
        break;
      }
      
      case 'go_to_jail':
        player.isInJail = true;
        player.position = 10;
        break;
      
      case 'pay':
        if (card.action.target === 'bank') {
          player.coins -= card.action.amount;
        } else if (card.action.target === 'players') {
          const total = card.action.amount * (state.players.length - 1);
          player.coins -= total;
          state.players.forEach(p => {
            if (p.id !== player.id) p.coins += card.action!.amount;
          });
        }
        break;
      
      case 'receive':
        if (card.action.from === 'bank') {
          player.coins += card.action.amount;
        } else if (card.action.from === 'players') {
          state.players.forEach(p => {
            if (p.id !== player.id) {
              p.coins -= card.action!.amount;
              player.coins += card.action!.amount;
            }
          });
        }
        break;
      
      case 'get_out_of_jail_free':
        player.hasGetOutOfJailFree = true;
        break;
      
      case 'repairs': {
        const houses = player.properties.reduce((sum, propId) => {
          const prop = state.properties.find(p => p.id === propId);
          return sum + (prop?.houseCount || 0);
        }, 0);
        const hotels = player.properties.filter(propId => {
          const prop = state.properties.find(p => p.id === propId);
          return prop?.hasHotel;
        }).length;
        const cost = houses * card.action.houseCost + hotels * card.action.hotelCost;
        player.coins -= cost;
        break;
      }
    }
  }

  private handlePayJailFine(state: TrollopolyGameState, playerId: string): TrollopolyGameState {
    const player = state.players.find(p => p.id === playerId);
    if (!player || !player.isInJail) return state;

    player.coins -= 50;
    player.isInJail = false;
    player.jailTurns = 0;

    this.addLogEntry(state, 'jail', `${player.username} paid 50 coins to get out of jail.`, playerId);
    
    state.phase = 'waiting_for_roll';
    return state;
  }

  private handleUseJailCard(state: TrollopolyGameState, playerId: string): TrollopolyGameState {
    const player = state.players.find(p => p.id === playerId);
    if (!player || !player.isInJail || !player.hasGetOutOfJailFree) return state;

    player.hasGetOutOfJailFree = false;
    player.isInJail = false;
    player.jailTurns = 0;

    this.addLogEntry(state, 'jail', `${player.username} used Get Out of Jail Free card!`, playerId);
    
    state.phase = 'waiting_for_roll';
    return state;
  }

  private handleTryJailDoubles(state: TrollopolyGameState, playerId: string): TrollopolyGameState {
    // This is handled in roll_dice when player is in jail
    return state;
  }

  private handleEndTurn(state: TrollopolyGameState): TrollopolyGameState {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    state.turnCount++;
    state.phase = 'waiting_for_roll';
    return state;
  }

  private handleAuctionProperty(state: TrollopolyGameState, payload: any): TrollopolyGameState {
    // Auction logic would go here
    state.phase = 'waiting_for_roll';
    return state;
  }

  private handleAddSpectator(state: TrollopolyGameState, payload: { id: string; username: string; avatarUrl?: string }): TrollopolyGameState {
    if (!state.spectators.find(s => s.id === payload.id)) {
      state.spectators.push({
        id: payload.id,
        username: payload.username,
        avatarUrl: payload.avatarUrl,
        joinedAt: new Date().toISOString(),
      });
      state.spectatorCount = state.spectators.length;
    }
    return state;
  }

  private handleRemoveSpectator(state: TrollopolyGameState, payload: { id: string }): TrollopolyGameState {
    state.spectators = state.spectators.filter(s => s.id !== payload.id);
    state.spectatorCount = state.spectators.length;
    return state;
  }

  private handleJoinQueue(state: TrollopolyGameState, payload: { userId: string; username: string }): TrollopolyGameState {
    if (!state.queueState) {
      state.queueState = {
        playersInQueue: [],
        countdownDuration: 15,
      };
    }
    
    if (!state.queueState.playersInQueue.includes(payload.userId)) {
      state.queueState.playersInQueue.push(payload.userId);
    }

    // Start countdown if we have min players
    if (state.queueState.playersInQueue.length >= 2 && !state.queueState.countdownStartTime) {
      state.queueState.countdownStartTime = Date.now();
    }

    return state;
  }

  private handleLeaveQueue(state: TrollopolyGameState, payload: { userId: string }): TrollopolyGameState {
    if (state.queueState) {
      state.queueState.playersInQueue = state.queueState.playersInQueue.filter(
        id => id !== payload.userId
      );
      
      // Reset countdown if below min players
      if (state.queueState.playersInQueue.length < 2) {
        state.queueState.countdownStartTime = undefined;
      }
    }
    return state;
  }

  updateGameState(state: TrollopolyGameState, deltaTime: number): TrollopolyGameState {
    // Handle countdown
    if (state.phase === 'countdown') {
      const newTimer = state.timerRemaining - deltaTime / 1000;
      if (newTimer <= 0) {
        return this.handleStartGame({ ...state, timerRemaining: 0 });
      }
      return { ...state, timerRemaining: newTimer };
    }

    // Handle dice rolling animation
    if (state.dice.isRolling) {
      state.dice.animationProgress += deltaTime / 1000; // 1 second roll
      if (state.dice.animationProgress >= 1) {
        state.dice.isRolling = false;
        state.dice.animationProgress = 0;
        return this.handleMoveComplete(state);
      }
    }

    // Handle queue countdown
    if (state.queueState?.countdownStartTime) {
      const elapsed = (Date.now() - state.queueState.countdownStartTime) / 1000;
      const remaining = state.queueState.countdownDuration - elapsed;
      
      if (remaining <= 0 && state.queueState.playersInQueue.length >= 2) {
        // Start the game
        return this.handleStartGame(state);
      }
    }

    return state;
  }

  checkWinCondition(state: TrollopolyGameState): { winnerId?: string; isDraw: boolean } | null {
    // Check if only one player is not bankrupt
    const activePlayers = state.players.filter(p => !p.isBankrupt);
    
    if (activePlayers.length === 1) {
      return { winnerId: activePlayers[0].id, isDraw: false };
    }

    // Check if we've played too many turns (draw)
    if (state.turnCount > 200) {
      // Find player with most coins + property value
      let maxValue = -1;
      let winnerId: string | undefined;
      let isDraw = false;

      for (const player of state.players) {
        const propertyValue = player.properties.reduce((sum, propId) => {
          const prop = state.properties.find(p => p.id === propId);
          return sum + (prop?.price || 0);
        }, 0);
        const totalValue = player.coins + propertyValue;

        if (totalValue > maxValue) {
          maxValue = totalValue;
          winnerId = player.id;
          isDraw = false;
        } else if (totalValue === maxValue) {
          isDraw = true;
        }
      }

      return { winnerId, isDraw };
    }

    return null;
  }
}

export default TrollopolyEngine;
