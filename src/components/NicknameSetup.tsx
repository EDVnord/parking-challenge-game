import { useState } from 'react';
import { PLAYER_EMOJIS } from '@/pages/parkingTypes';

const NICK_KEY = 'parking_nick';
const EMOJI_KEY = 'parking_emoji';

export function getSavedNick(): { name: string; emoji: string } | null {
  const name = localStorage.getItem(NICK_KEY);
  const emoji = localStorage.getItem(EMOJI_KEY);
  if (name && name.length >= 2 && name.length <= 16) return { name, emoji: emoji ?? '😎' };
  return null;
}

function saveNick(name: string, emoji: string) {
  localStorage.setItem(NICK_KEY, name);
  localStorage.setItem(EMOJI_KEY, emoji);
}

interface NicknameSetupProps {
  onDone: (name: string, emoji: string) => void;
}

export default function NicknameSetup({ onDone }: NicknameSetupProps) {
  const [name, setName] = useState(() => localStorage.getItem(NICK_KEY) ?? '');
  const [emoji, setEmoji] = useState(() => localStorage.getItem(EMOJI_KEY) ?? '😎');
  const [error, setError] = useState('');

  const handle = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Введи ник'); return; }
    if (trimmed.length < 2) { setError('Минимум 2 символа'); return; }
    if (trimmed.length > 16) { setError('Максимум 16 символов'); return; }
    if (!/^[a-zA-Zа-яА-ЯёЁ0-9_\- ]+$/.test(trimmed)) { setError('Только буквы, цифры, _ и -'); return; }
    saveNick(trimmed, emoji);
    onDone(trimmed, emoji);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-gray-950/95 backdrop-blur-sm">
      <div className="card-game w-full max-w-sm p-6 flex flex-col items-center gap-5 animate-bounce-in">
        <div className="text-6xl animate-float">{emoji}</div>
        <div className="text-center">
          <h2 className="font-russo text-2xl text-yellow-400">Придумай ник</h2>
          <p className="font-nunito text-white/40 text-sm mt-1">Он будет виден другим игрокам в игре</p>
        </div>

        <div className="w-full">
          <input
            type="text"
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            onKeyDown={e => e.key === 'Enter' && handle()}
            placeholder="Твой ник..."
            maxLength={16}
            autoFocus
            className="w-full bg-white/10 border-2 border-yellow-400/50 rounded-2xl px-4 py-3 font-russo text-white text-lg outline-none text-center placeholder:text-white/20 focus:border-yellow-400"
          />
          {error && <p className="text-red-400 text-xs font-nunito text-center mt-1">{error}</p>}
        </div>

        <div className="w-full">
          <p className="font-nunito text-white/30 text-xs text-center mb-2">Выбери аватар:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {PLAYER_EMOJIS.map(em => (
              <button
                key={em}
                onClick={() => setEmoji(em)}
                className={`text-2xl p-2 rounded-xl transition-all ${emoji === em ? 'bg-yellow-400/30 scale-110 border border-yellow-400/60' : 'hover:bg-white/10'}`}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <button
          className="btn-yellow w-full py-3 text-lg"
          onClick={handle}
          disabled={!name.trim()}
        >
          Поехали! 🚀
        </button>
      </div>
    </div>
  );
}