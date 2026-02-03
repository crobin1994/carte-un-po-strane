// Card types
export interface BlackCard {
  id: string;
  text: string;
  pick: number; // How many white cards to pick (usually 1, sometimes 2)
}

export interface WhiteCard {
  id: string;
  text: string;
  isCustom?: boolean;
}

// Player state
export interface Player {
  id: string;
  name: string;
  score: number;
  hand: WhiteCard[];
  isHost: boolean;
  isConnected: boolean;
}

// Submitted card during a round
export interface Submission {
  playerId: string;
  cards: WhiteCard[];
}

// Game phases
export type GamePhase =
  | 'lobby'      // Waiting for players
  | 'playing'    // Submitting cards
  | 'judging'    // Zar is picking winner
  | 'reveal'     // Showing winning card
  | 'ended';     // Game over

// Game state
export interface GameState {
  roomCode: string;
  phase: GamePhase;
  players: Player[];
  currentZarId: string | null;
  currentBlackCard: BlackCard | null;
  submissions: Submission[];
  winningSubmission: Submission | null;
  roundNumber: number;
  maxScore: number; // First to reach this wins (default 7)
  customWhiteCards: WhiteCard[];
  customBlackCards: BlackCard[];
}

// Socket events from client to server
export interface ClientToServerEvents {
  'create-room': (playerName: string) => void;
  'join-room': (roomCode: string, playerName: string) => void;
  'rejoin-room': (roomCode: string, playerId: string) => void;
  'start-game': () => void;
  'submit-cards': (cardIds: string[]) => void;
  'pick-winner': (playerId: string) => void;
  'add-custom-card': (type: 'black' | 'white', text: string, pick?: number) => void;
  'next-round': () => void;
}

// Socket events from server to client
export interface ServerToClientEvents {
  'room-created': (roomCode: string, playerId: string) => void;
  'room-joined': (playerId: string, state: GameState) => void;
  'player-joined': (player: Player) => void;
  'player-left': (playerId: string) => void;
  'player-disconnected': (playerId: string) => void;
  'player-reconnected': (playerId: string) => void;
  'game-started': (state: GameState) => void;
  'new-round': (state: GameState) => void;
  'card-submitted': (playerId: string) => void;
  'all-submitted': (submissions: Submission[]) => void;
  'judging-started': (state: GameState) => void;
  'winner-picked': (winnerId: string, submission: Submission) => void;
  'game-ended': (winnerId: string, finalScores: { playerId: string; score: number }[]) => void;
  'custom-card-added': (type: 'black' | 'white', card: BlackCard | WhiteCard) => void;
  'error': (message: string) => void;
}
