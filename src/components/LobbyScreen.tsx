import { useEffect, useState, useRef } from 'react';
import type { RoomState } from '@/pages/parkingTypes';

interface LobbyScreenProps {
  room: RoomState;
  localPlayerId: string;
  onCancel: () => void;
}

const LOBBY_WAIT_SEC = 15;

export default function LobbyScreen({ room, localPlayerId, onCancel }: LobbyScreenProps) {
  const [secs, setSecs] = useState(Math.max(0, Math.ceil((room.timerEnd - Date.now()) / 1000)));
  const [copied, setCopied] = useState(false);
  const [dots, setDots] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const realPlayers = room.players.filter(p => !p.is_bot);
  const totalSlots = 10;
  const botSlots = totalSlots - realPlayers.length;

  const inviteCode = room.roomId.slice(0, 8).toUpperCase();
  const inviteLink = `${window.location.origin}${window.location.pathname}?room=${inviteCode}`;

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecs(Math.max(0, Math.ceil((room.timerEnd - Date.now()) / 1000)));
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [room.timerEnd]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback
      const el = document.createElement('textarea');
      el.value = inviteLink;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const progress = Math.max(0, Math.min(1, 1 - secs / LOBBY_WAIT_SEC));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">
      <div className="w-full max-w-sm flex flex-col gap-4">

        {/* Заголовок */}
        <div className="card-game-solid p-5 flex flex-col items-center gap-3 text-center">
          <div className="text-5xl animate-float">🅿️</div>
          <div>
            <h2 className="font-russo text-2xl text-yellow-400">Поиск игроков{dots}</h2>
            <p className="font-nunito text-white/40 text-xs mt-1">
              {secs > 0
                ? `Через ${secs}с добавятся боты до 10 машин`
                : 'Запускаем с ботами...'
              }
            </p>
          </div>

          {/* Прогресс-бар */}
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Счётчик игроков */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse inline-block" />
              <span className="font-russo text-green-400 text-lg">{realPlayers.length}</span>
              <span className="text-white/30 font-nunito text-sm">реальных</span>
            </div>
            <span className="text-white/20">+</span>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40 font-russo text-lg">{botSlots}</span>
              <span className="text-white/30 font-nunito text-sm">ботов</span>
            </div>
            <span className="text-white/20">=</span>
            <div className="font-russo text-white text-lg">10 🚗</div>
          </div>
        </div>

        {/* Список игроков */}
        <div className="card-game p-4 flex flex-col gap-2">
          <div className="font-russo text-white/50 text-xs uppercase tracking-wider mb-1">Игроки в комнате</div>
          <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
            {realPlayers.map(p => (
              <div
                key={p.player_id}
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
                  p.player_id === localPlayerId
                    ? 'bg-yellow-400/15 border border-yellow-400/30'
                    : 'bg-white/5'
                }`}
              >
                <span className="text-lg">{p.emoji}</span>
                <span className={`font-nunito text-sm flex-1 ${p.player_id === localPlayerId ? 'text-yellow-400 font-bold' : 'text-white/80'}`}>
                  {p.name}{p.player_id === localPlayerId && ' (ты)'}
                </span>
                <span className="text-green-400 text-xs">● онлайн</span>
              </div>
            ))}
            {/* Пустые слоты */}
            {Array.from({ length: Math.max(0, botSlots) }).map((_, i) => (
              <div key={`bot_${i}`} className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-white/3 border border-dashed border-white/10">
                <span className="text-white/20 text-lg">🤖</span>
                <span className="font-nunito text-white/20 text-sm">Бот{dots}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Пригласить друга */}
        <div className="card-game p-4 flex flex-col gap-2">
          <div className="font-russo text-white/50 text-xs uppercase tracking-wider">🔗 Пригласить друга</div>
          <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-2">
            <code className="font-nunito text-yellow-400 text-sm flex-1 truncate">{inviteCode}</code>
            <button
              className={`text-xs font-russo px-3 py-1.5 rounded-lg transition-all ${
                copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              onClick={handleCopyLink}
            >
              {copied ? '✓ Скопировано' : 'Копировать'}
            </button>
          </div>
          <p className="text-white/20 text-xs font-nunito">Отправь другу код — он введёт его при старте игры</p>
        </div>

        <button className="btn-red py-3 font-russo" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}
