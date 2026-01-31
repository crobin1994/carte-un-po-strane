'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';
import { WhiteCard as WhiteCardType } from '../types/game';

// Card component
function Card({
  type,
  text,
  selected,
  onClick,
  disabled,
  showWinner,
}: {
  type: 'black' | 'white';
  text: string;
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  showWinner?: boolean;
}) {
  const baseClasses =
    'rounded-lg p-4 font-bold text-left transition-all duration-200 relative';
  const blackClasses = 'bg-zinc-900 text-white border-2 border-zinc-700';
  const whiteClasses = `bg-white text-black ${
    onClick && !disabled ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : ''
  } ${selected ? 'ring-4 ring-purple-500 scale-105' : ''} ${
    disabled ? 'opacity-50 cursor-not-allowed' : ''
  }`;

  return (
    <div
      className={`${baseClasses} ${type === 'black' ? blackClasses : whiteClasses}`}
      onClick={onClick && !disabled ? onClick : undefined}
    >
      <p className="text-sm leading-relaxed">{text}</p>
      {showWinner && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full">
          VINCITORE
        </div>
      )}
    </div>
  );
}

// Scoreboard component
function Scoreboard({
  players,
  currentZarId,
  maxScore,
}: {
  players: { id: string; name: string; score: number; isHost: boolean }[];
  currentZarId: string | null;
  maxScore: number;
}) {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-zinc-900 rounded-lg p-4">
      <h3 className="text-lg font-bold mb-3">Punteggio (primo a {maxScore})</h3>
      <ul className="space-y-2">
        {sortedPlayers.map((player, index) => (
          <li
            key={player.id}
            className={`flex items-center justify-between px-3 py-2 rounded ${
              player.id === currentZarId ? 'bg-purple-600' : 'bg-zinc-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-sm">{index + 1}.</span>
              <span>{player.name}</span>
              {player.id === currentZarId && (
                <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">
                  ZAR
                </span>
              )}
            </div>
            <span className="font-bold text-xl">{player.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  const {
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
  } = useSocket();

  const [playerName, setPlayerName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [customCardText, setCustomCardText] = useState('');
  const [customCardType, setCustomCardType] = useState<'white' | 'black'>('white');
  const [selectedCards, setSelectedCards] = useState<string[]>([]);

  // Reset selected cards on new round
  useEffect(() => {
    if (gameState?.phase === 'playing') {
      setSelectedCards([]);
    }
  }, [gameState?.roundNumber, gameState?.phase]);

  // If in a room, show the lobby
  if (gameState && gameState.phase === 'lobby') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8">
          {/* Room Code */}
          <div className="text-center">
            <h1 className="text-4xl font-black mb-2">STANZA</h1>
            <div className="text-6xl font-black text-purple-500 tracking-wider">
              {roomCode}
            </div>
            <p className="text-zinc-400 mt-2">
              Condividi questo codice con i tuoi amici
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded">
              {error}
            </div>
          )}

          {/* Players */}
          <div className="bg-zinc-900 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-3">
              Giocatori ({gameState.players.length}/8)
            </h2>
            <ul className="space-y-2">
              {gameState.players.map((player) => (
                <li
                  key={player.id}
                  className="flex items-center justify-between bg-zinc-800 px-3 py-2 rounded"
                >
                  <span>{player.name}</span>
                  {player.isHost && (
                    <span className="text-xs bg-purple-500 px-2 py-1 rounded">
                      HOST
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Custom Cards */}
          <div className="bg-zinc-900 rounded-lg p-4">
            <h2 className="text-xl font-bold mb-3">Aggiungi Carta Personalizzata</h2>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setCustomCardType('white')}
                className={`flex-1 py-2 rounded font-bold ${
                  customCardType === 'white'
                    ? 'bg-white text-black'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Bianca
              </button>
              <button
                onClick={() => setCustomCardType('black')}
                className={`flex-1 py-2 rounded font-bold ${
                  customCardType === 'black'
                    ? 'bg-zinc-800 text-white border-2 border-white'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                Nera
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customCardText}
                onChange={(e) => setCustomCardText(e.target.value)}
                placeholder={
                  customCardType === 'white'
                    ? 'Testo della risposta...'
                    : 'Domanda con _____ ...'
                }
                className="flex-1 px-3 py-2 bg-zinc-800 rounded outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={() => {
                  if (customCardText.trim()) {
                    addCustomCard(customCardType, customCardText.trim());
                    setCustomCardText('');
                  }
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded font-bold"
              >
                +
              </button>
            </div>
            {/* Show custom cards count */}
            <p className="text-zinc-400 text-sm mt-2">
              {gameState.customWhiteCards.length} carte bianche,{' '}
              {gameState.customBlackCards.length} carte nere aggiunte
            </p>
          </div>

          {/* Start Button (host only) */}
          {isHost && (
            <button
              onClick={startGame}
              disabled={gameState.players.length < 3}
              className={`w-full py-4 rounded-lg font-black text-xl ${
                gameState.players.length >= 3
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {gameState.players.length >= 3
                ? "INIZIA PARTITA"
                : `SERVONO ${3 - gameState.players.length} GIOCATORI`}
            </button>
          )}
          {!isHost && (
            <div className="text-center text-zinc-400">
              In attesa che l&apos;host avvii la partita...
            </div>
          )}
        </div>
      </div>
    );
  }

  // Game in progress (playing, judging, reveal phases)
  if (gameState && (gameState.phase === 'playing' || gameState.phase === 'judging' || gameState.phase === 'reveal')) {
    const requiredPick = gameState.currentBlackCard?.pick || 1;

    const handleCardSelect = (cardId: string) => {
      if (hasSubmitted || isZar) return;

      setSelectedCards((prev) => {
        if (prev.includes(cardId)) {
          return prev.filter((id) => id !== cardId);
        }
        if (prev.length >= requiredPick) {
          return [...prev.slice(1), cardId];
        }
        return [...prev, cardId];
      });
    };

    const handleSubmit = () => {
      if (selectedCards.length === requiredPick) {
        submitCards(selectedCards);
        setSelectedCards([]);
      }
    };

    const handlePickWinner = (submissionPlayerId: string) => {
      if (isZar && gameState.phase === 'judging') {
        pickWinner(submissionPlayerId);
      }
    };

    return (
      <div className="min-h-screen bg-zinc-950 text-white p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-black">STANZA: {roomCode}</h1>
              <p className="text-zinc-400">Round {gameState.roundNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-400">Sei</p>
              <p className="font-bold text-lg">
                {currentPlayer?.name}
                {isZar && <span className="ml-2 text-yellow-500">(ZAR)</span>}
              </p>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div className="grid lg:grid-cols-4 gap-6">
            {/* Main game area */}
            <div className="lg:col-span-3 space-y-6">
              {/* Black card */}
              <div className="max-w-md">
                <h2 className="text-lg font-bold mb-2 text-zinc-400">Carta Nera</h2>
                {gameState.currentBlackCard && (
                  <Card type="black" text={gameState.currentBlackCard.text} />
                )}
                {requiredPick > 1 && (
                  <p className="text-sm text-zinc-400 mt-2">
                    Scegli {requiredPick} carte
                  </p>
                )}
              </div>

              {/* Playing phase */}
              {gameState.phase === 'playing' && (
                <div className="space-y-4">
                  {isZar ? (
                    <div className="bg-zinc-900 rounded-lg p-6 text-center">
                      <h3 className="text-xl font-bold mb-2">Sei lo Zar!</h3>
                      <p className="text-zinc-400">
                        Aspetta che tutti i giocatori inviino le loro carte...
                      </p>
                      <p className="text-zinc-500 mt-2">
                        {submittedPlayers.size} / {gameState.players.length - 1} hanno
                        inviato
                      </p>
                    </div>
                  ) : hasSubmitted ? (
                    <div className="bg-zinc-900 rounded-lg p-6 text-center">
                      <h3 className="text-xl font-bold mb-2 text-green-500">
                        Carte inviate!
                      </h3>
                      <p className="text-zinc-400">
                        Aspetta che tutti gli altri inviino...
                      </p>
                      <p className="text-zinc-500 mt-2">
                        {submittedPlayers.size} / {gameState.players.length - 1} hanno
                        inviato
                      </p>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-lg font-bold text-zinc-400">Le tue carte</h2>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                        {currentPlayer?.hand.map((card) => (
                          <Card
                            key={card.id}
                            type="white"
                            text={card.text}
                            selected={selectedCards.includes(card.id)}
                            onClick={() => handleCardSelect(card.id)}
                          />
                        ))}
                      </div>
                      <button
                        onClick={handleSubmit}
                        disabled={selectedCards.length !== requiredPick}
                        className={`w-full py-4 rounded-lg font-black text-xl ${
                          selectedCards.length === requiredPick
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                        }`}
                      >
                        {selectedCards.length === requiredPick
                          ? 'INVIA CARTE'
                          : `SELEZIONA ${requiredPick - selectedCards.length} CART${
                              requiredPick - selectedCards.length === 1 ? 'A' : 'E'
                            }`}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Judging phase */}
              {gameState.phase === 'judging' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-bold text-zinc-400">
                    {isZar
                      ? 'Scegli la risposta migliore!'
                      : `${currentZar?.name} sta scegliendo...`}
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {gameState.submissions.map((submission, index) => (
                      <div
                        key={index}
                        className={`space-y-2 ${isZar ? 'cursor-pointer' : ''}`}
                        onClick={() => handlePickWinner(submission.playerId)}
                      >
                        {submission.cards.map((card, cardIndex) => (
                          <Card
                            key={cardIndex}
                            type="white"
                            text={card.text}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reveal phase */}
              {gameState.phase === 'reveal' && (
                <div className="space-y-6">
                  <div className="bg-zinc-900 rounded-lg p-6 text-center">
                    <h2 className="text-2xl font-bold mb-4">
                      {gameState.players.find(
                        (p) => p.id === gameState.winningSubmission?.playerId
                      )?.name}{' '}
                      ha vinto questo round!
                    </h2>
                    <div className="flex justify-center gap-4">
                      {gameState.winningSubmission?.cards.map((card, index) => (
                        <div key={index} className="max-w-xs">
                          <Card type="white" text={card.text} showWinner />
                        </div>
                      ))}
                    </div>
                  </div>

                  {isHost && (
                    <button
                      onClick={nextRound}
                      className="w-full py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-black text-xl"
                    >
                      PROSSIMO ROUND
                    </button>
                  )}
                  {!isHost && (
                    <p className="text-center text-zinc-400">
                      In attesa che l&apos;host passi al prossimo round...
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar - Scoreboard */}
            <div className="lg:col-span-1">
              <Scoreboard
                players={gameState.players}
                currentZarId={gameState.currentZarId}
                maxScore={gameState.maxScore}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Game ended
  if (gameState && gameState.phase === 'ended') {
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];

    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-4xl font-black mb-2">PARTITA FINITA!</h1>
            <p className="text-2xl text-purple-500 font-bold">
              {winner.name} ha vinto!
            </p>
          </div>

          <div className="bg-zinc-900 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4">Classifica Finale</h2>
            <ol className="space-y-3">
              {sortedPlayers.map((player, index) => (
                <li
                  key={player.id}
                  className={`flex items-center justify-between px-4 py-3 rounded ${
                    index === 0
                      ? 'bg-yellow-500 text-black'
                      : index === 1
                      ? 'bg-zinc-600'
                      : index === 2
                      ? 'bg-amber-700'
                      : 'bg-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">
                      {index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`}
                    </span>
                    <span className="font-bold">{player.name}</span>
                  </div>
                  <span className="text-2xl font-black">{player.score}</span>
                </li>
              ))}
            </ol>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 rounded-lg font-black text-xl"
          >
            NUOVA PARTITA
          </button>
        </div>
      </div>
    );
  }

  // Main menu
  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-8 text-center">
          <div>
            <h1 className="text-5xl font-black mb-2">CARTE CONTRO</h1>
            <h2 className="text-3xl font-black text-purple-500">L&apos;UMANITA&apos;</h2>
            <p className="text-zinc-400 mt-2">Dario Moccia Edition</p>
          </div>

          {!isConnected && (
            <div className="text-yellow-500">Connessione al server...</div>
          )}

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={() => setMode('create')}
              disabled={!isConnected}
              className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-400 rounded-lg font-black text-xl"
            >
              CREA STANZA
            </button>
            <button
              onClick={() => setMode('join')}
              disabled={!isConnected}
              className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-700 disabled:text-zinc-400 rounded-lg font-black text-xl"
            >
              UNISCITI
            </button>
          </div>

          <p className="text-zinc-500 text-sm">
            3-8 giocatori | Primo a 7 punti vince
          </p>
        </div>
      </div>
    );
  }

  // Create room form
  if (mode === 'create') {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <button
            onClick={() => setMode('menu')}
            className="text-zinc-400 hover:text-white"
          >
            &larr; Indietro
          </button>

          <h1 className="text-3xl font-black">CREA STANZA</h1>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-zinc-400 mb-2">Il tuo nome</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Inserisci il tuo nome..."
              maxLength={20}
              className="w-full px-4 py-3 bg-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-lg"
            />
          </div>

          <button
            onClick={() => {
              if (playerName.trim()) {
                createRoom(playerName.trim());
              }
            }}
            disabled={!playerName.trim()}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-400 rounded-lg font-black text-xl"
          >
            CREA
          </button>
        </div>
      </div>
    );
  }

  // Join room form
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <button
          onClick={() => setMode('menu')}
          className="text-zinc-400 hover:text-white"
        >
          &larr; Indietro
        </button>

        <h1 className="text-3xl font-black">UNISCITI</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-2 rounded">
            {error}
          </div>
        )}

        <div>
          <label className="block text-zinc-400 mb-2">Codice stanza</label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="Es. PEFFO42"
            maxLength={10}
            className="w-full px-4 py-3 bg-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-lg uppercase tracking-wider"
          />
        </div>

        <div>
          <label className="block text-zinc-400 mb-2">Il tuo nome</label>
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Inserisci il tuo nome..."
            maxLength={20}
            className="w-full px-4 py-3 bg-zinc-800 rounded-lg outline-none focus:ring-2 focus:ring-purple-500 text-lg"
          />
        </div>

        <button
          onClick={() => {
            if (playerName.trim() && joinCode.trim()) {
              joinRoom(joinCode.trim(), playerName.trim());
            }
          }}
          disabled={!playerName.trim() || !joinCode.trim()}
          className="w-full py-4 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-400 rounded-lg font-black text-xl"
        >
          UNISCITI
        </button>
      </div>
    </div>
  );
}
