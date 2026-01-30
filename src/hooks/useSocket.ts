'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  GameState,
  Player,
  Submission,
  BlackCard,
  WhiteCard,
} from '../types/game';

// Get socket URL from environment or derive from current host
function getSocketUrl() {
  // Use environment variable if set (for production)
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL;
  }
  // Fallback for local development
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const host = window.location.hostname;
  return `http://${host}:3001`;
}

export function useSocket() {
  const [socket, setSocket] = useState<Socket<
    ServerToClientEvents,
    ClientToServerEvents
  > | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedPlayers, setSubmittedPlayers] = useState<Set<string>>(new Set());

  // Connect to socket server
  useEffect(() => {
    const newSocket = io(getSocketUrl(), {
      autoConnect: true,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('error', (message: string) => {
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    newSocket.on('room-created', (code: string, id: string) => {
      setRoomCode(code);
      setPlayerId(id);
    });

    newSocket.on('room-joined', (id: string, state: GameState) => {
      setPlayerId(id);
      setRoomCode(state.roomCode);
      setGameState(state);
      setSubmittedPlayers(new Set());
    });

    newSocket.on('player-joined', (player: Player) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: [...prev.players, player],
        };
      });
    });

    newSocket.on('player-left', (leftPlayerId: string) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          players: prev.players.filter((p) => p.id !== leftPlayerId),
        };
      });
      setSubmittedPlayers((prev) => {
        const next = new Set(prev);
        next.delete(leftPlayerId);
        return next;
      });
    });

    newSocket.on('game-started', (state: GameState) => {
      setGameState(state);
      setSubmittedPlayers(new Set());
    });

    newSocket.on('new-round', (state: GameState) => {
      setGameState(state);
      setSubmittedPlayers(new Set());
    });

    newSocket.on('card-submitted', (submittedPlayerId: string) => {
      setSubmittedPlayers((prev) => new Set([...prev, submittedPlayerId]));
    });

    newSocket.on('all-submitted', (submissions: Submission[]) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          submissions,
          phase: 'judging',
        };
      });
    });

    newSocket.on('judging-started', (state: GameState) => {
      setGameState(state);
    });

    newSocket.on('winner-picked', (winnerId: string, submission: Submission) => {
      setGameState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          winningSubmission: submission,
          phase: 'reveal',
          players: prev.players.map((p) =>
            p.id === winnerId ? { ...p, score: p.score + 1 } : p
          ),
        };
      });
    });

    newSocket.on(
      'game-ended',
      (winnerId: string, finalScores: { playerId: string; score: number }[]) => {
        setGameState((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            phase: 'ended',
            players: prev.players.map((p) => {
              const score = finalScores.find((s) => s.playerId === p.id);
              return score ? { ...p, score: score.score } : p;
            }),
          };
        });
      }
    );

    newSocket.on(
      'custom-card-added',
      (type: 'black' | 'white', card: BlackCard | WhiteCard) => {
        setGameState((prev) => {
          if (!prev) return prev;
          if (type === 'black') {
            return {
              ...prev,
              customBlackCards: [...prev.customBlackCards, card as BlackCard],
            };
          } else {
            return {
              ...prev,
              customWhiteCards: [...prev.customWhiteCards, card as WhiteCard],
            };
          }
        });
      }
    );

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  // Actions
  const createRoom = useCallback(
    (playerName: string) => {
      socket?.emit('create-room', playerName);
    },
    [socket]
  );

  const joinRoom = useCallback(
    (code: string, playerName: string) => {
      socket?.emit('join-room', code.toUpperCase(), playerName);
    },
    [socket]
  );

  const startGame = useCallback(() => {
    socket?.emit('start-game');
  }, [socket]);

  const submitCards = useCallback(
    (cardIds: string[]) => {
      socket?.emit('submit-cards', cardIds);
    },
    [socket]
  );

  const pickWinner = useCallback(
    (winnerId: string) => {
      socket?.emit('pick-winner', winnerId);
    },
    [socket]
  );

  const nextRound = useCallback(() => {
    socket?.emit('next-round');
  }, [socket]);

  const addCustomCard = useCallback(
    (type: 'black' | 'white', text: string, pick?: number) => {
      socket?.emit('add-custom-card', type, text, pick);
    },
    [socket]
  );

  // Computed values
  const currentPlayer = gameState?.players.find((p) => p.id === playerId);
  const isHost = currentPlayer?.isHost ?? false;
  const isZar = gameState?.currentZarId === playerId;
  const currentZar = gameState?.players.find(
    (p) => p.id === gameState?.currentZarId
  );
  const hasSubmitted = playerId ? submittedPlayers.has(playerId) : false;

  return {
    isConnected,
    gameState,
    playerId,
    roomCode,
    error,
    currentPlayer,
    isHost,
    isZar,
    currentZar,
    hasSubmitted,
    submittedPlayers,
    createRoom,
    joinRoom,
    startGame,
    submitCards,
    pickWinner,
    nextRound,
    addCustomCard,
  };
}
