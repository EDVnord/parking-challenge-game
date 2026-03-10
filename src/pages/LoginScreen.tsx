import { useState } from 'react';
import { PLAYER_EMOJIS } from './parkingTypes';
import { t } from '@/i18n';

// ──────────────── PROFILE CARD ────────────────
interface ProfileCardProps {
  player: { name: string; emoji: string; level: number; nicknameChanges?: number };
  xpInLevel: number;
  xpNeeded: number;
  onEmojiChange: (em: string) => void;
  onNameChange: (name: string) => void;
}

export function ProfileCard({ player, xpInLevel, xpNeeded, onEmojiChange }: ProfileCardProps) {
  return (
    <div className="card-game-solid p-6 flex flex-col items-center gap-4">
      <div className="relative">
        <div className="text-7xl animate-float">{player.emoji}</div>
        <div className="absolute -bottom-1 -right-2 bg-yellow-400 text-gray-900 font-russo text-xs rounded-full w-7 h-7 flex items-center justify-center">{player.level}</div>
      </div>

      <div className="text-center">
        <div className="font-russo text-2xl text-white">{player.name}</div>
        <div className="text-white/30 text-sm font-nunito">{t('profile_level_label')} {player.level}</div>
      </div>

      <div className="w-full">
        <div className="flex justify-between text-xs font-nunito font-bold mb-1">
          <span className="text-white/30">{t('profile_xp_label')}</span>
          <span className="text-yellow-400">{xpInLevel} / {xpNeeded} XP</span>
        </div>
        <div className="damage-bar h-3">
          <div className="hp-bar bg-yellow-400" style={{ width: `${(xpInLevel / xpNeeded) * 100}%` }} />
        </div>
      </div>

      <div>
        <div className="text-white/30 text-xs font-nunito mb-2 text-center">{t('profile_avatar_label')}:</div>
        <div className="flex gap-2 flex-wrap justify-center">
          {PLAYER_EMOJIS.map(em => (
            <button key={em} onClick={() => onEmojiChange(em)}
              className={`text-2xl p-1.5 rounded-xl transition-all ${player.emoji === em ? 'bg-yellow-400/30 scale-110' : 'hover:bg-white/10'}`}>
              {em}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────── PRIVACY POLICY MODAL ────────────────
interface PrivacyPolicyModalProps {
  onClose: () => void;
}

export function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card-game-solid w-full max-w-lg flex flex-col gap-4 p-5 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-russo text-white text-lg">{t('privacy_policy_title')}</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
        </div>
        <div className="font-nunito text-white/60 text-sm flex flex-col gap-3">
          <p><strong className="text-white/80">{t('privacy_data_title')}</strong><br/>{t('privacy_data_text')}</p>
          <p><strong className="text-white/80">{t('privacy_id_title')}</strong><br/>{t('privacy_id_text')}</p>
          <p><strong className="text-white/80">{t('privacy_pay_title')}</strong><br/>{t('privacy_pay_text')}</p>
          <p><strong className="text-white/80">{t('privacy_ads_title')}</strong><br/>{t('privacy_ads_text')}</p>
          <p className="text-white/30 text-xs">{t('privacy_updated')}</p>
        </div>
        <button className="btn-game bg-white/10 text-white border-b-white/20 py-2" onClick={onClose}>{t('privacy_close')}</button>
      </div>
    </div>
  );
}

// ──────────────── LOGIN SCREEN ────────────────
interface LoginScreenProps {
  onLogin: (name: string, password: string) => Promise<string | null>;
  onRegister: (name: string, emoji: string, password: string) => Promise<string | null>;
}

export default function LoginScreen({ onLogin, onRegister }: LoginScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [inputName, setInputName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState('😎');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchTab = (t: 'login' | 'register') => {
    setTab(t); setError(''); setPassword(''); setPasswordConfirm('');
  };

  const handleLogin = async () => {
    const name = inputName.trim();
    if (!name) { setError('Введи ник'); return; }
    if (!password) { setError('Введи пароль'); return; }
    setLoading(true); setError('');
    const err = await onLogin(name, password);
    setLoading(false);
    if (err) setError(err);
  };

  const handleRegister = async () => {
    const name = inputName.trim();
    if (!name || name.length < 2) { setError('Имя минимум 2 символа'); return; }
    if (name.length > 16) { setError('Имя максимум 16 символов'); return; }
    if (password.length < 4) { setError('Пароль минимум 4 символа'); return; }
    if (password !== passwordConfirm) { setError('Пароли не совпадают'); return; }
    setLoading(true); setError('');
    const err = await onRegister(name, selectedEmoji, password);
    setLoading(false);
    if (err) setError(err);
  };

  const inputCls = "w-full bg-white/10 border-2 border-white/20 focus:border-yellow-400/60 rounded-2xl px-4 py-3 font-nunito text-white text-base outline-none transition-all placeholder:text-white/20";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[{ em: '🚗', cls: 'top-8 left-8', d: '0s' }, { em: '🏎️', cls: 'top-16 right-12', d: '1.2s' },
          { em: '🚕', cls: 'bottom-16 left-16', d: '2s' }, { em: '🚙', cls: 'bottom-12 right-10', d: '0.6s' }]
          .map((item, i) => <div key={i} className={`absolute text-5xl animate-float ${item.cls}`} style={{ animationDelay: item.d }}>{item.em}</div>)}
        <div className="absolute top-1/3 left-1/4 w-72 h-72 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-5 w-full max-w-sm animate-fade-in">
        <div className="text-center">
          <div className="text-7xl mb-2 animate-bounce-in">👑</div>
          <h1 className="font-russo text-4xl text-yellow-400 leading-none" style={{ textShadow: '0 0 30px rgba(255,214,0,0.6)' }}>КОРОЛЬ</h1>
          <h1 className="font-russo text-4xl text-yellow-400 leading-none" style={{ textShadow: '0 0 30px rgba(255,214,0,0.6)' }}>ПАРКОВКИ</h1>
          <p className="text-white/30 text-xs font-nunito font-bold tracking-widest uppercase mt-1">Захвати место — стань королём!</p>
        </div>

        <div className="flex w-full gap-1 bg-white/5 rounded-2xl p-1">
          <button
            className={`flex-1 py-2.5 rounded-xl font-russo text-sm transition-all ${tab === 'login' ? 'bg-yellow-400 text-gray-900' : 'text-white/50 hover:text-white'}`}
            onClick={() => switchTab('login')}>
            Войти
          </button>
          <button
            className={`flex-1 py-2.5 rounded-xl font-russo text-sm transition-all ${tab === 'register' ? 'bg-yellow-400 text-gray-900' : 'text-white/50 hover:text-white'}`}
            onClick={() => switchTab('register')}>
            Регистрация
          </button>
        </div>

        <div className="card-game-solid p-6 flex flex-col gap-4 w-full">
          {tab === 'login' && (<>
            <input type="text" value={inputName}
              onChange={e => { setInputName(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder="Твой ник"
              maxLength={16}
              autoFocus
              className={inputCls}
            />
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Пароль"
                className={inputCls}
              />
              <button onClick={() => setShowPwd(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 text-sm">
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            {error && <div className="text-red-400 text-xs font-nunito text-center">{error}</div>}
            <button className="btn-yellow w-full text-lg py-3" onClick={handleLogin} disabled={loading}>
              {loading ? '⏳ Входим...' : '▶ Войти'}
            </button>
          </>)}

          {tab === 'register' && (<>
            <div>
              <div className="text-white/40 text-xs font-nunito mb-2 text-center uppercase tracking-wider">Аватар</div>
              <div className="flex gap-2 flex-wrap justify-center">
                {PLAYER_EMOJIS.map(em => (
                  <button key={em} onClick={() => setSelectedEmoji(em)}
                    className={`text-2xl p-1.5 rounded-xl transition-all ${selectedEmoji === em ? 'bg-yellow-400/30 scale-110 border-2 border-yellow-400/50' : 'hover:bg-white/10 border-2 border-transparent'}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>
            <input type="text" value={inputName}
              onChange={e => { setInputName(e.target.value); setError(''); }}
              placeholder="Придумай ник (2–16 символов)"
              maxLength={16}
              autoFocus
              className={inputCls}
            />
            <div className="relative">
              <input type={showPwd ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Придумай пароль (мин. 4 символа)"
                className={inputCls}
              />
              <button onClick={() => setShowPwd(v => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 text-sm">
                {showPwd ? '🙈' : '👁️'}
              </button>
            </div>
            <input type={showPwd ? 'text' : 'password'} value={passwordConfirm}
              onChange={e => { setPasswordConfirm(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleRegister()}
              placeholder="Повтори пароль"
              className={inputCls}
            />
            {error && <div className="text-red-400 text-xs font-nunito text-center">{error}</div>}
            <button className="btn-yellow w-full text-lg py-3" onClick={handleRegister} disabled={loading}>
              {loading ? '⏳ Создаём...' : '🚀 Создать и войти'}
            </button>
          </>)}
        </div>
      </div>
    </div>
  );
}