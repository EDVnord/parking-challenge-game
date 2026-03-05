import React from 'react';
import { PlayerData, LeaderEntry, LeaderboardResult, Screen } from './parkingTypes';
import FriendsPanel from '@/components/FriendsPanel';

// ──────────────── FRIENDS ────────────────
interface FriendsScreenProps {
  player: PlayerData;
  localPlayerId: string;
  setScreen: (s: Screen) => void;
  notify: (msg: string) => void;
}

export function FriendsScreen({ player, localPlayerId, setScreen, notify }: FriendsScreenProps) {
  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
        <h2 className="font-russo text-2xl text-yellow-400">👥 Друзья</h2>
      </div>
      <FriendsPanel playerName={player.name} playerEmoji={player.emoji} localPlayerId={localPlayerId} notify={notify} />
    </div>
  );
}

// ──────────────── LEADERBOARD ────────────────
interface LeaderboardScreenProps {
  player: PlayerData;
  leaderboardData: LeaderboardResult;
  setScreen: (s: Screen) => void;
}

export function LeaderboardScreen({ player, leaderboardData, setScreen }: LeaderboardScreenProps) {
  const { leaders: onlineLeaders, myRank } = leaderboardData;
  const fullList: LeaderEntry[] = onlineLeaders.length > 0 ? onlineLeaders : [
    { rank: 1, name: player.name || 'Ты', emoji: player.emoji, wins: player.wins, xp: player.xp, gamesPlayed: player.gamesPlayed }
  ];
  const rankColors = ['#FFD600', '#C0C0C0', '#CD7F32'];
  const medals = ['🥇', '🥈', '🥉'];
  const isInTop = fullList.some(e => e.name === player.name);
  const myRankDisplay = myRank ?? (isInTop ? fullList.find(e => e.name === player.name)?.rank : null);

  return (
    <div className="min-h-screen flex flex-col px-4 py-6 gap-5 max-w-lg mx-auto">
      <div className="flex items-center gap-3">
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2 px-4" onClick={() => setScreen('menu')}>←</button>
        <h2 className="font-russo text-2xl text-yellow-400">🏆 Топ игроков</h2>
      </div>

      {/* Пьедестал */}
      <div className="flex items-end justify-center gap-4 py-2">
        {([fullList[1], fullList[0], fullList[2]] as typeof fullList).filter(Boolean).map((p, podiumIdx) => {
          const podiumRanks = [2, 1, 3];
          const heights = [80, 110, 60];
          const rank = podiumRanks[podiumIdx];
          const isMe = p.name === player.name;
          return (
            <div key={p.rank} className="flex flex-col items-center gap-1">
              <div className={`text-3xl ${isMe ? 'animate-bounce' : ''}`}>{p.emoji}</div>
              <div className={`font-russo text-xs text-center max-w-16 truncate ${isMe ? 'text-yellow-400' : 'text-white'}`}>{p.name}</div>
              <div className="w-20 rounded-t-xl flex items-start justify-center pt-2"
                style={{ height: `${heights[podiumIdx]}px`, background: `${rankColors[rank - 1]}22`, border: `2px solid ${rankColors[rank - 1]}55` }}>
                <span className="font-russo text-2xl" style={{ color: rankColors[rank - 1] }}>#{rank}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Список топ-10 */}
      <div className="space-y-2">
        {fullList.map(entry => {
          const isMe = entry.name === player.name;
          return (
            <div key={entry.rank} className={`card-game p-3 flex items-center gap-3 ${isMe ? 'border border-yellow-500/40 bg-yellow-500/5' : ''}`}>
              <div className="font-russo text-lg w-8 text-center shrink-0" style={{ color: entry.rank <= 3 ? rankColors[entry.rank - 1] : 'rgba(255,255,255,0.3)' }}>
                {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
              </div>
              <div className="text-xl shrink-0">{entry.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className={`font-russo text-sm truncate ${isMe ? 'text-yellow-400' : 'text-white'}`}>{entry.name}{isMe && ' 👑'}</div>
                <div className="text-white/30 text-xs font-nunito">{entry.xp.toLocaleString()} XP</div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-russo text-yellow-400 text-sm">{entry.wins}</div>
                <div className="text-white/30 text-xs font-nunito">побед</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Место игрока если не в топ-10 */}
      {!isInTop && myRankDisplay && (
        <div className="card-game-solid p-3 flex items-center gap-3 border border-yellow-500/30">
          <div className="font-russo text-lg w-8 text-center shrink-0 text-white/40">#{myRankDisplay}</div>
          <div className="text-xl shrink-0">{player.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="font-russo text-sm text-yellow-400 truncate">{player.name} 👑 (ты)</div>
            <div className="text-white/30 text-xs font-nunito">{player.xp.toLocaleString()} XP</div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-russo text-yellow-400 text-sm">{player.wins}</div>
            <div className="text-white/30 text-xs font-nunito">побед</div>
          </div>
        </div>
      )}

      {onlineLeaders.length === 0 && (
        <p className="text-center text-white/20 font-nunito text-sm">Данные загружаются...</p>
      )}
    </div>
  );
}