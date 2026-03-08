import { useEffect, useState, useRef } from 'react';
import type { RoomState } from '@/pages/parkingTypes';
import { getMyFriendCode, getFriends } from '@/components/FriendsPanel';

const TIPS = [
  { icon: '🏅', text: 'Заходи в Достижения — там могут быть незабранные награды!' },
  { icon: '⚡', text: 'Нитро: зажми Space на клавиатуре или кнопку ⚡ на экране во время езды.' },
  { icon: '🛒', text: 'Расходники в Магазине — буст монет x2 и XP x2 ускоряют прокачку.' },
  { icon: '❤️', text: 'Вторая жизнь из Расходников спасёт, если тебя выбьют из раунда.' },
  { icon: '🧲', text: 'Магнит притягивает машину к месту парковки — удобно в финальных раундах.' },
  { icon: '🛡️', text: 'Силовое поле поглощает первый удар за раунд — покупай против таранщиков.' },
  { icon: '🔧', text: 'Ремонтируй машину в Гараже: с низким HP скорость заметно падает.' },
  { icon: '👥', text: 'Добавляй друзей — при совместной игре оба получают +20% монет и XP.' },
  { icon: '📡', text: 'GPS-радар показывает стрелку к ближайшему свободному месту.' },
  { icon: '🚀', text: 'Турбо-старт даёт двойную скорость на 2 секунды после сигнала — врывайся первым!' },
  { icon: '🎯', text: 'Выполняй ежедневные задания — они обновляются каждый день.' },
  { icon: '🪙', text: 'Прокачивай машины в Гараже: HP, броня и скорость открывают разные стили.' },
  { icon: '💎', text: 'Кристаллы выгоднее тратить на апгрейды в Магазине, чем менять на монеты.' },
  { icon: '🏆', text: 'Победа в турнире — самый быстрый способ заработать монеты и XP.' },
];

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
  const [toast, setToast] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPlayerIdsRef = useRef<Set<string>>(new Set(room.players.map(p => p.player_id)));
  const myFriendCode = getMyFriendCode();

  const [tipIdx, setTipIdx] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [tipVisible, setTipVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipVisible(false);
      setTimeout(() => {
        setTipIdx(i => (i + 1) % TIPS.length);
        setTipVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const realPlayers = room.players.filter(p => !p.is_bot);
  const totalSlots = 10;
  const botSlots = totalSlots - realPlayers.length;

  // Следим за новыми игроками — проверяем, нет ли среди них друзей
  useEffect(() => {
    const friends = getFriends();
    const currentIds = new Set(room.players.map(p => p.player_id));

    room.players.forEach(p => {
      if (p.is_bot || p.player_id === localPlayerId) return;
      if (prevPlayerIdsRef.current.has(p.player_id)) return;

      // Новый игрок — проверяем, друг ли он
      const isFriend = friends.some(f =>
        p.player_id.toUpperCase().includes(f.code) || f.code.includes(p.player_id.toUpperCase().slice(0, 8))
      );

      if (isFriend) {
        const friend = friends.find(f =>
          p.player_id.toUpperCase().includes(f.code) || f.code.includes(p.player_id.toUpperCase().slice(0, 8))
        );
        setToast(`👥 ${friend?.name ?? p.name} присоединился! +10% монет`);
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast(`${p.emoji} ${p.name} вошёл в лобби`);
        setTimeout(() => setToast(null), 2500);
      }
    });

    prevPlayerIdsRef.current = currentIds;
  }, [room.players, localPlayerId]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecs(Math.max(0, Math.ceil((room.timerEnd - Date.now()) / 1000)));
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 500);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [room.timerEnd]);

  const handleCopyLink = () => {
    const text = `Привет! Добавь мой код в игре "Король парковки" → Друзья: ${myFriendCode} — и получим бонус +10% монет при совместной игре!`;
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progress = Math.max(0, Math.min(1, 1 - secs / LOBBY_WAIT_SEC));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in px-4">

      {/* Тост уведомление о новом игроке */}
      {toast && (
        <div className="absolute top-6 left-0 right-0 flex justify-center z-10 pointer-events-none">
          <div className="bg-gray-900 border border-yellow-500/40 rounded-2xl px-5 py-2.5 font-russo text-white text-sm shadow-2xl animate-fade-in">
            {toast}
          </div>
        </div>
      )}

      <div className="w-full max-w-sm flex flex-col gap-3">

        {/* Заголовок */}
        <div className="card-game-solid p-5 flex flex-col items-center gap-3 text-center">
          <div className="text-5xl animate-float">🅿️</div>
          <div>
            <h2 className="font-russo text-2xl text-yellow-400">Поиск игроков{dots}</h2>
            <p className="font-nunito text-white/40 text-xs mt-1">
              {secs > 0 ? `Через ${secs}с добавятся боты до 10 машин` : 'Запускаем...'}
            </p>
          </div>

          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-yellow-400 rounded-full transition-all duration-500"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
              <span className="font-russo text-green-400">{realPlayers.length}</span>
              <span className="text-white/30 font-nunito">реальных</span>
            </div>
            <span className="text-white/20">+</span>
            <div className="flex items-center gap-1.5">
              <span className="text-white/40 font-russo">{botSlots}</span>
              <span className="text-white/30 font-nunito">ботов</span>
            </div>
            <span className="text-white/20">=</span>
            <div className="font-russo text-white">10 🚗</div>
          </div>
        </div>

        {/* Список игроков */}
        <div className="card-game p-4 flex flex-col gap-2">
          <div className="font-russo text-white/40 text-xs uppercase tracking-wider mb-1">Игроки в комнате</div>
          <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
            {realPlayers.map(p => {
              const isMe = p.player_id === localPlayerId;
              const friends = getFriends();
              const isFriend = !isMe && friends.some(f =>
                p.player_id.toUpperCase().includes(f.code) || f.code.includes(p.player_id.toUpperCase().slice(0, 8))
              );
              return (
                <div
                  key={p.player_id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 transition-all ${
                    isMe ? 'bg-yellow-400/15 border border-yellow-400/30'
                    : isFriend ? 'bg-green-500/10 border border-green-500/30'
                    : 'bg-white/5'
                  }`}
                >
                  <span className="text-base">{p.emoji}</span>
                  <span className={`font-nunito text-sm flex-1 truncate ${isMe ? 'text-yellow-400 font-bold' : isFriend ? 'text-green-400' : 'text-white/80'}`}>
                    {p.name}{isMe && ' (ты)'}{isFriend && ' 👥'}
                  </span>
                  <span className={`text-xs shrink-0 ${isFriend ? 'text-green-400' : 'text-green-500/60'}`}>● онлайн</span>
                </div>
              );
            })}
            {Array.from({ length: Math.max(0, botSlots) }).map((_, i) => (
              <div key={`bot_${i}`} className="flex items-center gap-2 rounded-lg px-3 py-1.5 bg-white/3 border border-dashed border-white/10">
                <span className="text-white/20 text-base">🤖</span>
                <span className="font-nunito text-white/20 text-sm">Бот{dots}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Пригласить друга */}
        <div className="card-game p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-nunito text-white/30 text-xs">👥 Твой код для друга</div>
            <div className="font-russo text-yellow-400 text-sm tracking-widest truncate">{myFriendCode}</div>
          </div>
          <button
            className={`shrink-0 text-xs font-russo px-3 py-1.5 rounded-lg transition-all ${
              copied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            onClick={handleCopyLink}
          >
            {copied ? '✓ Скопировано' : 'Копировать'}
          </button>
        </div>

        {/* Совет дня */}
        <div
          className="card-game px-4 py-3 flex gap-3 items-start transition-all duration-400"
          style={{ opacity: tipVisible ? 1 : 0, transform: tipVisible ? 'translateY(0)' : 'translateY(6px)' }}
        >
          <span className="text-xl shrink-0 mt-0.5">{TIPS[tipIdx].icon}</span>
          <div>
            <div className="text-white/30 text-[10px] font-russo uppercase tracking-widest mb-0.5">Совет</div>
            <div className="text-white/70 font-nunito text-xs leading-relaxed">{TIPS[tipIdx].text}</div>
          </div>
        </div>

        <button className="btn-red py-3 font-russo" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
}