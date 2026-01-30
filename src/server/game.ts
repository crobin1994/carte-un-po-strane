import {
  GameState,
  GamePhase,
  Player,
  BlackCard,
  WhiteCard,
  Submission,
} from '../types/game';
import {
  getShuffledBlackCards,
  getShuffledWhiteCards,
  shuffleArray,
} from '../data/cards';

const HAND_SIZE = 10;
const DEFAULT_MAX_SCORE = 7;

// Generate a random room code
function generateRoomCode(): string {
  const words = ['PEFFO', 'SBUSTO', 'PADRE', 'LETTO', 'ANIME', 'MANGA', 'TWITCH', 'DARIO'];
  const word = words[Math.floor(Math.random() * words.length)];
  const num = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return `${word}${num}`;
}

// Generate unique ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

export class Game {
  state: GameState;
  private blackDeck: BlackCard[];
  private whiteDeck: WhiteCard[];

  constructor(roomCode?: string) {
    this.blackDeck = getShuffledBlackCards();
    this.whiteDeck = getShuffledWhiteCards();

    this.state = {
      roomCode: roomCode || generateRoomCode(),
      phase: 'lobby',
      players: [],
      currentZarId: null,
      currentBlackCard: null,
      submissions: [],
      winningSubmission: null,
      roundNumber: 0,
      maxScore: DEFAULT_MAX_SCORE,
      customWhiteCards: [],
      customBlackCards: [],
    };
  }

  // Add a player to the game
  addPlayer(id: string, name: string, isHost: boolean = false): Player | null {
    if (this.state.phase !== 'lobby') {
      return null; // Can't join mid-game
    }

    if (this.state.players.length >= 8) {
      return null; // Max players reached
    }

    if (this.state.players.some(p => p.name.toLowerCase() === name.toLowerCase())) {
      return null; // Name already taken
    }

    const player: Player = {
      id,
      name,
      score: 0,
      hand: [],
      isHost,
      isConnected: true,
    };

    this.state.players.push(player);
    return player;
  }

  // Remove a player from the game
  removePlayer(playerId: string): boolean {
    const index = this.state.players.findIndex(p => p.id === playerId);
    if (index === -1) return false;

    const player = this.state.players[index];

    // Return cards to deck
    this.whiteDeck.push(...player.hand);

    // Remove player
    this.state.players.splice(index, 1);

    // If game is in progress and too few players, end it
    if (this.state.phase !== 'lobby' && this.state.players.length < 3) {
      this.state.phase = 'ended';
    }

    // If current Zar left, move to next round
    if (this.state.currentZarId === playerId && this.state.phase !== 'ended') {
      this.nextRound();
    }

    return true;
  }

  // Mark player as disconnected (for reconnection)
  disconnectPlayer(playerId: string): void {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = false;
    }
  }

  // Reconnect a player
  reconnectPlayer(playerId: string): Player | null {
    const player = this.state.players.find(p => p.id === playerId);
    if (player) {
      player.isConnected = true;
      return player;
    }
    return null;
  }

  // Start the game
  startGame(): boolean {
    if (this.state.phase !== 'lobby') return false;
    if (this.state.players.length < 3) return false;

    // Add custom cards to decks
    this.whiteDeck.push(...this.state.customWhiteCards);
    this.blackDeck.push(...this.state.customBlackCards);

    // Shuffle decks
    this.whiteDeck = shuffleArray(this.whiteDeck);
    this.blackDeck = shuffleArray(this.blackDeck);

    // Deal cards to all players
    for (const player of this.state.players) {
      player.hand = this.drawWhiteCards(HAND_SIZE);
    }

    // Pick first Zar randomly
    const randomIndex = Math.floor(Math.random() * this.state.players.length);
    this.state.currentZarId = this.state.players[randomIndex].id;

    // Draw first black card
    this.state.currentBlackCard = this.drawBlackCard();
    this.state.phase = 'playing';
    this.state.roundNumber = 1;

    return true;
  }

  // Draw white cards from deck
  private drawWhiteCards(count: number): WhiteCard[] {
    const cards: WhiteCard[] = [];
    for (let i = 0; i < count; i++) {
      if (this.whiteDeck.length === 0) {
        // Reshuffle discarded cards if deck is empty
        // For simplicity, we'll just break here
        break;
      }
      cards.push(this.whiteDeck.pop()!);
    }
    return cards;
  }

  // Draw a black card from deck
  private drawBlackCard(): BlackCard | null {
    if (this.blackDeck.length === 0) {
      return null;
    }
    return this.blackDeck.pop()!;
  }

  // Submit cards for a player
  submitCards(playerId: string, cardIds: string[]): boolean {
    if (this.state.phase !== 'playing') return false;
    if (playerId === this.state.currentZarId) return false; // Zar can't submit

    const player = this.state.players.find(p => p.id === playerId);
    if (!player) return false;

    // Check if already submitted
    if (this.state.submissions.some(s => s.playerId === playerId)) {
      return false;
    }

    // Validate card count matches black card pick count
    const requiredPick = this.state.currentBlackCard?.pick || 1;
    if (cardIds.length !== requiredPick) return false;

    // Find and remove cards from player's hand
    const submittedCards: WhiteCard[] = [];
    for (const cardId of cardIds) {
      const cardIndex = player.hand.findIndex(c => c.id === cardId);
      if (cardIndex === -1) return false; // Card not in hand
      submittedCards.push(player.hand.splice(cardIndex, 1)[0]);
    }

    // Add submission
    this.state.submissions.push({
      playerId,
      cards: submittedCards,
    });

    // Check if all non-Zar players have submitted
    const nonZarPlayers = this.state.players.filter(
      p => p.id !== this.state.currentZarId && p.isConnected
    );

    if (this.state.submissions.length >= nonZarPlayers.length) {
      // Shuffle submissions so Zar doesn't know who submitted what
      this.state.submissions = shuffleArray(this.state.submissions);
      this.state.phase = 'judging';
    }

    return true;
  }

  // Zar picks a winner
  pickWinner(zarId: string, winningPlayerId: string): boolean {
    if (this.state.phase !== 'judging') return false;
    if (zarId !== this.state.currentZarId) return false;

    const winningSubmission = this.state.submissions.find(
      s => s.playerId === winningPlayerId
    );
    if (!winningSubmission) return false;

    // Award point to winner
    const winner = this.state.players.find(p => p.id === winningPlayerId);
    if (winner) {
      winner.score += 1;

      // Check for game end
      if (winner.score >= this.state.maxScore) {
        this.state.winningSubmission = winningSubmission;
        this.state.phase = 'ended';
        return true;
      }
    }

    this.state.winningSubmission = winningSubmission;
    this.state.phase = 'reveal';
    return true;
  }

  // Move to next round
  nextRound(): boolean {
    if (this.state.phase !== 'reveal' && this.state.phase !== 'playing') {
      return false;
    }

    // Refill player hands
    for (const player of this.state.players) {
      const cardsNeeded = HAND_SIZE - player.hand.length;
      if (cardsNeeded > 0) {
        player.hand.push(...this.drawWhiteCards(cardsNeeded));
      }
    }

    // Move to next Zar
    const currentZarIndex = this.state.players.findIndex(
      p => p.id === this.state.currentZarId
    );
    const nextZarIndex = (currentZarIndex + 1) % this.state.players.length;
    this.state.currentZarId = this.state.players[nextZarIndex].id;

    // Draw new black card
    const newBlackCard = this.drawBlackCard();
    if (!newBlackCard) {
      // No more black cards, game ends
      this.state.phase = 'ended';
      return true;
    }

    this.state.currentBlackCard = newBlackCard;
    this.state.submissions = [];
    this.state.winningSubmission = null;
    this.state.roundNumber += 1;
    this.state.phase = 'playing';

    return true;
  }

  // Add a custom card
  addCustomCard(
    type: 'black' | 'white',
    text: string,
    pick: number = 1
  ): BlackCard | WhiteCard {
    const id = `custom-${generateId()}`;

    if (type === 'black') {
      const card: BlackCard = { id, text, pick };
      this.state.customBlackCards.push(card);
      return card;
    } else {
      const card: WhiteCard = { id, text, isCustom: true };
      this.state.customWhiteCards.push(card);
      return card;
    }
  }

  // Get player by ID
  getPlayer(playerId: string): Player | undefined {
    return this.state.players.find(p => p.id === playerId);
  }

  // Get current Zar
  getCurrentZar(): Player | undefined {
    return this.state.players.find(p => p.id === this.state.currentZarId);
  }

  // Check if a player has submitted
  hasSubmitted(playerId: string): boolean {
    return this.state.submissions.some(s => s.playerId === playerId);
  }

  // Get public game state (hide hands of other players)
  getPublicState(forPlayerId?: string): GameState {
    return {
      ...this.state,
      players: this.state.players.map(p => ({
        ...p,
        // Only show hand to the player themselves
        hand: p.id === forPlayerId ? p.hand : [],
      })),
      // Hide who submitted what during playing phase
      submissions:
        this.state.phase === 'judging' || this.state.phase === 'reveal'
          ? this.state.submissions
          : this.state.submissions.map(s => ({
              ...s,
              playerId: '', // Hide player ID during submission phase
            })),
    };
  }
}

// Store active games
export const games = new Map<string, Game>();

// Create a new game
export function createGame(): Game {
  const game = new Game();
  games.set(game.state.roomCode, game);
  return game;
}

// Get game by room code
export function getGame(roomCode: string): Game | undefined {
  return games.get(roomCode.toUpperCase());
}

// Delete a game
export function deleteGame(roomCode: string): void {
  games.delete(roomCode);
}
