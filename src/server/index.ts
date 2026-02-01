import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';
import { createGame, getGame, deleteGame, Game } from './game';
import { ClientToServerEvents, ServerToClientEvents } from '../types/game';

const app = express();
const server = http.createServer(app);

// Configure CORS - allow Vercel preview URLs and production URL
const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      // Allow localhost for development
      if (origin.includes('localhost')) return callback(null, true);

      // Allow all Vercel preview and production URLs for this project
      if (origin.includes('carte-un-po-strane') && origin.includes('vercel.app')) {
        return callback(null, true);
      }

      // Allow explicit FRONTEND_URL if set
      if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
        return callback(null, true);
      }

      console.log('[CORS] Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Track which room each socket is in
const socketRooms = new Map<string, string>();
const socketPlayerIds = new Map<string, string>();

// Grace period before deleting empty rooms (5 minutes)
const ROOM_GRACE_PERIOD_MS = 5 * 60 * 1000;
const roomDeletionTimers = new Map<string, NodeJS.Timeout>();

function scheduleRoomDeletion(roomCode: string) {
  // Clear any existing timer
  cancelRoomDeletion(roomCode);

  const timer = setTimeout(() => {
    const game = getGame(roomCode);
    if (game && game.state.players.length === 0) {
      deleteGame(roomCode);
      console.log(`[Game] Room ${roomCode} deleted after grace period`);
    }
    roomDeletionTimers.delete(roomCode);
  }, ROOM_GRACE_PERIOD_MS);

  roomDeletionTimers.set(roomCode, timer);
  console.log(`[Game] Room ${roomCode} scheduled for deletion in 5 minutes`);
}

function cancelRoomDeletion(roomCode: string) {
  const timer = roomDeletionTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    roomDeletionTimers.delete(roomCode);
    console.log(`[Game] Room ${roomCode} deletion cancelled`);
  }
}

io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log(`[Socket] User connected: ${socket.id}`);

  // Create a new room
  socket.on('create-room', (playerName: string) => {
    const game = createGame();
    const playerId = socket.id;

    const player = game.addPlayer(playerId, playerName, true);
    if (!player) {
      socket.emit('error', 'Impossibile creare la stanza');
      return;
    }

    socket.join(game.state.roomCode);
    socketRooms.set(socket.id, game.state.roomCode);
    socketPlayerIds.set(socket.id, playerId);

    console.log(`[Game] Room ${game.state.roomCode} created by ${playerName}`);
    socket.emit('room-created', game.state.roomCode, playerId);
    socket.emit('room-joined', playerId, game.getPublicState(playerId));
  });

  // Join an existing room
  socket.on('join-room', (roomCode: string, playerName: string) => {
    const game = getGame(roomCode);
    if (!game) {
      socket.emit('error', 'Stanza non trovata');
      return;
    }

    if (game.state.phase !== 'lobby') {
      socket.emit('error', 'Partita già in corso');
      return;
    }

    // Cancel any pending deletion if room was empty
    cancelRoomDeletion(roomCode);

    // If room is empty, this player becomes the host
    const isNewHost = game.state.players.length === 0;

    const playerId = socket.id;
    const player = game.addPlayer(playerId, playerName, isNewHost);
    if (!player) {
      socket.emit('error', 'Impossibile unirsi (nome già in uso o stanza piena)');
      return;
    }

    socket.join(roomCode);
    socketRooms.set(socket.id, roomCode);
    socketPlayerIds.set(socket.id, playerId);

    console.log(`[Game] ${playerName} joined room ${roomCode}${isNewHost ? ' (new host)' : ''}`);

    // Notify the new player
    socket.emit('room-joined', playerId, game.getPublicState(playerId));

    // Notify other players
    socket.to(roomCode).emit('player-joined', player);
  });

  // Start the game
  socket.on('start-game', () => {
    const roomCode = socketRooms.get(socket.id);
    const playerId = socketPlayerIds.get(socket.id);
    if (!roomCode || !playerId) return;

    const game = getGame(roomCode);
    if (!game) return;

    // Only host can start
    const player = game.getPlayer(playerId);
    if (!player?.isHost) {
      socket.emit('error', 'Solo l\'host può avviare la partita');
      return;
    }

    if (!game.startGame()) {
      socket.emit('error', 'Servono almeno 3 giocatori per iniziare');
      return;
    }

    console.log(`[Game] Room ${roomCode} started`);

    // Send personalized state to each player (with their hand)
    for (const p of game.state.players) {
      const playerSocket = io.sockets.sockets.get(p.id);
      if (playerSocket) {
        playerSocket.emit('game-started', game.getPublicState(p.id));
      }
    }
  });

  // Submit cards
  socket.on('submit-cards', (cardIds: string[]) => {
    const roomCode = socketRooms.get(socket.id);
    const playerId = socketPlayerIds.get(socket.id);
    if (!roomCode || !playerId) return;

    const game = getGame(roomCode);
    if (!game) return;

    if (!game.submitCards(playerId, cardIds)) {
      socket.emit('error', 'Impossibile inviare le carte');
      return;
    }

    console.log(`[Game] ${playerId} submitted cards in ${roomCode}`);

    // Notify all players that someone submitted
    io.to(roomCode).emit('card-submitted', playerId);

    // If all submitted, send full state update to each player
    if (game.state.phase === 'judging') {
      for (const p of game.state.players) {
        const playerSocket = io.sockets.sockets.get(p.id);
        if (playerSocket) {
          // Send complete state with real submission playerIds for judging
          playerSocket.emit('judging-started', game.getPublicState(p.id));
        }
      }
    }
  });

  // Pick winner (Zar only)
  socket.on('pick-winner', (winnerId: string) => {
    const roomCode = socketRooms.get(socket.id);
    const playerId = socketPlayerIds.get(socket.id);
    if (!roomCode || !playerId) return;

    const game = getGame(roomCode);
    if (!game) return;

    if (!game.pickWinner(playerId, winnerId)) {
      socket.emit('error', 'Impossibile scegliere il vincitore');
      return;
    }

    console.log(`[Game] Winner picked in ${roomCode}: ${winnerId}`);

    const winningSubmission = game.state.winningSubmission;
    if (!winningSubmission) return;

    io.to(roomCode).emit('winner-picked', winnerId, winningSubmission);

    // Check if game ended
    if (game.state.phase === 'ended') {
      const finalScores = game.state.players.map(p => ({
        playerId: p.id,
        score: p.score,
      }));
      io.to(roomCode).emit('game-ended', winnerId, finalScores);
    }
  });

  // Next round
  socket.on('next-round', () => {
    const roomCode = socketRooms.get(socket.id);
    const playerId = socketPlayerIds.get(socket.id);
    if (!roomCode || !playerId) return;

    const game = getGame(roomCode);
    if (!game) return;

    // Only host can advance rounds
    const player = game.getPlayer(playerId);
    if (!player?.isHost) {
      socket.emit('error', 'Solo l\'host può passare al round successivo');
      return;
    }

    if (!game.nextRound()) {
      socket.emit('error', 'Impossibile passare al round successivo');
      return;
    }

    console.log(`[Game] Next round in ${roomCode}, round ${game.state.roundNumber}`);

    // Send personalized state to each player
    for (const p of game.state.players) {
      const playerSocket = io.sockets.sockets.get(p.id);
      if (playerSocket) {
        playerSocket.emit('new-round', game.getPublicState(p.id));
      }
    }

    // Check if game ended (no more cards)
    if (game.state.phase === 'ended') {
      const winner = game.state.players.reduce((a, b) =>
        a.score > b.score ? a : b
      );
      const finalScores = game.state.players.map(p => ({
        playerId: p.id,
        score: p.score,
      }));
      io.to(roomCode).emit('game-ended', winner.id, finalScores);
    }
  });

  // Add custom card
  socket.on('add-custom-card', (type: 'black' | 'white', text: string, pick?: number) => {
    const roomCode = socketRooms.get(socket.id);
    if (!roomCode) return;

    const game = getGame(roomCode);
    if (!game) return;

    if (game.state.phase !== 'lobby') {
      socket.emit('error', 'Puoi aggiungere carte solo nella lobby');
      return;
    }

    const card = game.addCustomCard(type, text, pick);
    console.log(`[Game] Custom ${type} card added to ${roomCode}`);

    io.to(roomCode).emit('custom-card-added', type, card);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const roomCode = socketRooms.get(socket.id);
    const playerId = socketPlayerIds.get(socket.id);

    console.log(`[Socket] User disconnected: ${socket.id}`);

    if (roomCode && playerId) {
      const game = getGame(roomCode);
      if (game) {
        game.removePlayer(playerId);
        socket.to(roomCode).emit('player-left', playerId);

        // If no players left, schedule deletion with grace period
        if (game.state.players.length === 0) {
          scheduleRoomDeletion(roomCode);
        }
      }

      socketRooms.delete(socket.id);
      socketPlayerIds.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`[Server] Listening on port ${PORT}`);
});
