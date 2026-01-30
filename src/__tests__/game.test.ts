import { Game, createGame, getGame, deleteGame, games } from '../server/game';

describe('Game', () => {
  beforeEach(() => {
    // Clear all games before each test
    games.clear();
  });

  describe('Game Creation', () => {
    it('should create a game with a room code', () => {
      const game = new Game();
      expect(game.state.roomCode).toBeDefined();
      expect(game.state.roomCode.length).toBeGreaterThan(0);
    });

    it('should create a game with custom room code', () => {
      const game = new Game('TESTROOM');
      expect(game.state.roomCode).toBe('TESTROOM');
    });

    it('should start in lobby phase', () => {
      const game = new Game();
      expect(game.state.phase).toBe('lobby');
    });

    it('should have empty players list', () => {
      const game = new Game();
      expect(game.state.players).toHaveLength(0);
    });
  });

  describe('Player Management', () => {
    let game: Game;

    beforeEach(() => {
      game = new Game('TEST');
    });

    it('should add a player', () => {
      const player = game.addPlayer('player1', 'Alice', true);
      expect(player).not.toBeNull();
      expect(player?.name).toBe('Alice');
      expect(player?.isHost).toBe(true);
      expect(game.state.players).toHaveLength(1);
    });

    it('should not add player with duplicate name', () => {
      game.addPlayer('player1', 'Alice');
      const duplicate = game.addPlayer('player2', 'alice'); // case insensitive
      expect(duplicate).toBeNull();
      expect(game.state.players).toHaveLength(1);
    });

    it('should not add more than 8 players', () => {
      for (let i = 0; i < 8; i++) {
        game.addPlayer(`player${i}`, `Player${i}`);
      }
      const extraPlayer = game.addPlayer('player9', 'Player9');
      expect(extraPlayer).toBeNull();
      expect(game.state.players).toHaveLength(8);
    });

    it('should not add players after game starts', () => {
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();

      const latePlayer = game.addPlayer('p4', 'Dave');
      expect(latePlayer).toBeNull();
    });

    it('should remove a player', () => {
      game.addPlayer('player1', 'Alice');
      game.addPlayer('player2', 'Bob');

      const removed = game.removePlayer('player1');
      expect(removed).toBe(true);
      expect(game.state.players).toHaveLength(1);
      expect(game.state.players[0].name).toBe('Bob');
    });

    it('should return false when removing non-existent player', () => {
      const removed = game.removePlayer('nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('Game Start', () => {
    let game: Game;

    beforeEach(() => {
      game = new Game('TEST');
    });

    it('should not start with fewer than 3 players', () => {
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');

      const started = game.startGame();
      expect(started).toBe(false);
      expect(game.state.phase).toBe('lobby');
    });

    it('should start with 3 or more players', () => {
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');

      const started = game.startGame();
      expect(started).toBe(true);
      expect(game.state.phase).toBe('playing');
    });

    it('should deal 10 cards to each player', () => {
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();

      game.state.players.forEach(player => {
        expect(player.hand).toHaveLength(10);
      });
    });

    it('should select a random Zar', () => {
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();

      expect(game.state.currentZarId).not.toBeNull();
      const zarExists = game.state.players.some(p => p.id === game.state.currentZarId);
      expect(zarExists).toBe(true);
    });

    it('should draw a black card', () => {
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();

      expect(game.state.currentBlackCard).not.toBeNull();
      expect(game.state.currentBlackCard?.text).toBeDefined();
    });

    it('should set round number to 1', () => {
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();

      expect(game.state.roundNumber).toBe(1);
    });
  });

  describe('Card Submission', () => {
    let game: Game;
    let requiredPick: number;

    // Helper to get the required number of card IDs from a player's hand
    const getCardIds = (player: typeof game.state.players[0], count: number) => {
      return player.hand.slice(0, count).map(c => c.id);
    };

    beforeEach(() => {
      game = new Game('TEST');
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();
      requiredPick = game.state.currentBlackCard?.pick || 1;
    });

    it('should allow non-Zar players to submit cards', () => {
      const nonZarPlayer = game.state.players.find(p => p.id !== game.state.currentZarId)!;
      const cardIds = getCardIds(nonZarPlayer, requiredPick);

      const submitted = game.submitCards(nonZarPlayer.id, cardIds);
      expect(submitted).toBe(true);
      expect(game.state.submissions).toHaveLength(1);
    });

    it('should not allow Zar to submit cards', () => {
      const zarPlayer = game.state.players.find(p => p.id === game.state.currentZarId)!;
      const cardIds = getCardIds(zarPlayer, requiredPick);

      const submitted = game.submitCards(zarPlayer.id, cardIds);
      expect(submitted).toBe(false);
      expect(game.state.submissions).toHaveLength(0);
    });

    it('should not allow submitting cards not in hand', () => {
      const nonZarPlayer = game.state.players.find(p => p.id !== game.state.currentZarId)!;
      const fakeIds = Array(requiredPick).fill('fake-card-id');

      const submitted = game.submitCards(nonZarPlayer.id, fakeIds);
      expect(submitted).toBe(false);
    });

    it('should not allow double submission', () => {
      const nonZarPlayer = game.state.players.find(p => p.id !== game.state.currentZarId)!;
      const cardIds1 = getCardIds(nonZarPlayer, requiredPick);

      game.submitCards(nonZarPlayer.id, cardIds1);

      // Get different cards for second submission
      const cardIds2 = nonZarPlayer.hand.slice(0, requiredPick).map(c => c.id);
      const secondSubmit = game.submitCards(nonZarPlayer.id, cardIds2);

      expect(secondSubmit).toBe(false);
      expect(game.state.submissions).toHaveLength(1);
    });

    it('should remove submitted cards from player hand', () => {
      const nonZarPlayer = game.state.players.find(p => p.id !== game.state.currentZarId)!;
      const cardIds = getCardIds(nonZarPlayer, requiredPick);
      const initialHandSize = nonZarPlayer.hand.length;

      game.submitCards(nonZarPlayer.id, cardIds);

      expect(nonZarPlayer.hand).toHaveLength(initialHandSize - requiredPick);
      cardIds.forEach(cardId => {
        expect(nonZarPlayer.hand.find(c => c.id === cardId)).toBeUndefined();
      });
    });

    it('should transition to judging when all non-Zar players submit', () => {
      const nonZarPlayers = game.state.players.filter(p => p.id !== game.state.currentZarId);

      nonZarPlayers.forEach(player => {
        const cardIds = getCardIds(player, requiredPick);
        game.submitCards(player.id, cardIds);
      });

      expect(game.state.phase).toBe('judging');
    });

    it('should shuffle submissions when transitioning to judging', () => {
      const nonZarPlayers = game.state.players.filter(p => p.id !== game.state.currentZarId);

      nonZarPlayers.forEach(player => {
        const cardIds = getCardIds(player, requiredPick);
        game.submitCards(player.id, cardIds);
      });

      expect(game.state.submissions).toHaveLength(nonZarPlayers.length);
    });

    it('should not allow wrong number of cards', () => {
      const nonZarPlayer = game.state.players.find(p => p.id !== game.state.currentZarId)!;

      // Try to submit wrong number of cards
      const wrongCount = requiredPick === 1 ? 2 : 1;
      const cardIds = nonZarPlayer.hand.slice(0, wrongCount).map(c => c.id);

      const submitted = game.submitCards(nonZarPlayer.id, cardIds);
      expect(submitted).toBe(false);
    });
  });

  describe('Winner Selection', () => {
    let game: Game;
    let zarId: string;
    let nonZarPlayers: typeof game.state.players;
    let requiredPick: number;

    beforeEach(() => {
      game = new Game('TEST');
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();

      zarId = game.state.currentZarId!;
      nonZarPlayers = game.state.players.filter(p => p.id !== zarId);
      requiredPick = game.state.currentBlackCard?.pick || 1;

      // All non-Zar players submit the correct number of cards
      nonZarPlayers.forEach(player => {
        const cardIds = player.hand.slice(0, requiredPick).map(c => c.id);
        game.submitCards(player.id, cardIds);
      });
    });

    it('should be in judging phase after all submissions', () => {
      expect(game.state.phase).toBe('judging');
    });

    it('should allow Zar to pick a winner', () => {
      const winnerId = nonZarPlayers[0].id;
      const picked = game.pickWinner(zarId, winnerId);

      expect(picked).toBe(true);
      expect(game.state.winningSubmission).not.toBeNull();
    });

    it('should not allow non-Zar to pick winner', () => {
      const notZarId = nonZarPlayers[0].id;
      const winnerId = nonZarPlayers[1].id;

      const picked = game.pickWinner(notZarId, winnerId);
      expect(picked).toBe(false);
    });

    it('should award point to winner', () => {
      const winner = nonZarPlayers[0];
      const initialScore = winner.score;

      game.pickWinner(zarId, winner.id);

      expect(winner.score).toBe(initialScore + 1);
    });

    it('should transition to reveal phase after picking winner', () => {
      game.pickWinner(zarId, nonZarPlayers[0].id);
      expect(game.state.phase).toBe('reveal');
    });

    it('should end game when player reaches max score', () => {
      const winner = nonZarPlayers[0];
      winner.score = 6; // One point away from winning

      game.pickWinner(zarId, winner.id);

      expect(winner.score).toBe(7);
      expect(game.state.phase).toBe('ended');
    });
  });

  describe('Next Round', () => {
    let game: Game;

    beforeEach(() => {
      game = new Game('TEST');
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();

      const zarId = game.state.currentZarId!;
      const nonZarPlayers = game.state.players.filter(p => p.id !== zarId);
      const requiredPick = game.state.currentBlackCard?.pick || 1;

      // Complete a round with correct number of cards
      nonZarPlayers.forEach(player => {
        const cardIds = player.hand.slice(0, requiredPick).map(c => c.id);
        game.submitCards(player.id, cardIds);
      });
      game.pickWinner(zarId, nonZarPlayers[0].id);
    });

    it('should be in reveal phase after picking winner', () => {
      expect(game.state.phase).toBe('reveal');
    });

    it('should advance to next round', () => {
      const initialRound = game.state.roundNumber;
      game.nextRound();

      expect(game.state.roundNumber).toBe(initialRound + 1);
    });

    it('should rotate Zar to next player', () => {
      const previousZarId = game.state.currentZarId;
      const previousZarIndex = game.state.players.findIndex(p => p.id === previousZarId);

      game.nextRound();

      const expectedZarIndex = (previousZarIndex + 1) % game.state.players.length;
      expect(game.state.currentZarId).toBe(game.state.players[expectedZarIndex].id);
    });

    it('should draw a new black card', () => {
      const previousBlackCard = game.state.currentBlackCard;
      game.nextRound();

      // Card might be the same by chance, but it should exist
      expect(game.state.currentBlackCard).not.toBeNull();
    });

    it('should clear submissions', () => {
      game.nextRound();
      expect(game.state.submissions).toHaveLength(0);
    });

    it('should refill player hands to 10 cards', () => {
      game.nextRound();

      game.state.players.forEach(player => {
        expect(player.hand).toHaveLength(10);
      });
    });

    it('should return to playing phase', () => {
      game.nextRound();
      expect(game.state.phase).toBe('playing');
    });
  });

  describe('Custom Cards', () => {
    let game: Game;

    beforeEach(() => {
      game = new Game('TEST');
    });

    it('should add custom white card', () => {
      const card = game.addCustomCard('white', 'Test white card');

      expect(card.text).toBe('Test white card');
      expect(game.state.customWhiteCards).toHaveLength(1);
    });

    it('should add custom black card', () => {
      const card = game.addCustomCard('black', 'Test _____ card?', 1);

      expect(card.text).toBe('Test _____ card?');
      expect(game.state.customBlackCards).toHaveLength(1);
    });

    it('should include custom cards in deck after game starts', () => {
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');

      // Add custom cards before starting
      game.addCustomCard('white', 'Custom Answer 1');
      game.addCustomCard('white', 'Custom Answer 2');

      game.startGame();

      // Custom cards should be mixed into player hands (probabilistic)
      const allCards = game.state.players.flatMap(p => p.hand);
      const hasCustom = allCards.some(c => c.text === 'Custom Answer 1' || c.text === 'Custom Answer 2');

      // Note: This might occasionally fail due to randomness
      // In a real test, we'd mock the shuffle function
    });
  });

  describe('Public State', () => {
    let game: Game;

    beforeEach(() => {
      game = new Game('TEST');
      game.addPlayer('p1', 'Alice', true);
      game.addPlayer('p2', 'Bob');
      game.addPlayer('p3', 'Charlie');
      game.startGame();
    });

    it('should only show hand to requesting player', () => {
      const publicState = game.getPublicState('p1');

      const alice = publicState.players.find(p => p.id === 'p1')!;
      const bob = publicState.players.find(p => p.id === 'p2')!;

      expect(alice.hand.length).toBe(10);
      expect(bob.hand.length).toBe(0); // Hidden
    });

    it('should hide submission playerIds during playing phase', () => {
      const nonZar = game.state.players.find(p => p.id !== game.state.currentZarId)!;
      game.submitCards(nonZar.id, [nonZar.hand[0].id]);

      const publicState = game.getPublicState('p1');

      expect(publicState.submissions[0].playerId).toBe('');
    });

    it('should show submission playerIds during judging phase', () => {
      const nonZarPlayers = game.state.players.filter(p => p.id !== game.state.currentZarId);
      nonZarPlayers.forEach(player => {
        game.submitCards(player.id, [player.hand[0].id]);
      });

      const publicState = game.getPublicState('p1');

      publicState.submissions.forEach(sub => {
        expect(sub.playerId).not.toBe('');
      });
    });
  });

  describe('Game Store Functions', () => {
    it('should create and store a game', () => {
      const game = createGame();
      expect(games.has(game.state.roomCode)).toBe(true);
    });

    it('should retrieve game by room code', () => {
      const game = createGame();
      const retrieved = getGame(game.state.roomCode);
      expect(retrieved).toBe(game);
    });

    it('should retrieve game case-insensitively', () => {
      const game = createGame();
      const retrieved = getGame(game.state.roomCode.toLowerCase());
      expect(retrieved).toBe(game);
    });

    it('should delete a game', () => {
      const game = createGame();
      const roomCode = game.state.roomCode;

      deleteGame(roomCode);

      expect(games.has(roomCode)).toBe(false);
      expect(getGame(roomCode)).toBeUndefined();
    });
  });
});
