import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlayerData, DEFAULT_PLAYER, FRIENDS_URL,
  loadProfile, saveProfile, profileToSavePayload,
  apiAuth, getYaPlayer, initYandexGames, notifyGameReady, getOrCreateAnonId,
  DAILY_STREAK_REWARDS, makeDailyQuests, todayDateStr, restoreGemPurchases,
} from '@/pages/parkingTypes';
import { initI18n, t } from '@/i18n';
import { getSavedNick } from '@/components/NicknameSetup';

async function prefetchFriendCode(localPlayerId: string) {
  try {
    const ids = localPlayerId.startsWith('ya_')
      ? { yaId: localPlayerId }
      : { playerId: localPlayerId || getOrCreateAnonId() };
    const res = await fetch(FRIENDS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', ...ids }),
    });
    const data = await res.json();
    if (data.myCode) localStorage.setItem('parking_my_friend_code', data.myCode);
    if (data.friends) localStorage.setItem('parking_friends_cache_v2', JSON.stringify(data.friends));
  } catch { /* ignore */ }
}

export function usePlayerAuth(notify: (msg: string) => void) {
  const [player, setPlayer] = useState<PlayerData>(() => loadProfile() ?? DEFAULT_PLAYER);
  const [localPlayerId, setLocalPlayerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [needNickname, setNeedNickname] = useState(false);
  const [dailyBonus, setDailyBonus] = useState<{ streak: number; coins: number; gems: number } | null>(null);
  const autoLoginDone = useRef(false);
  // Используем state вместо ref чтобы эффект автосохранения корректно срабатывал
  const [serverLoadDone, setServerLoadDone] = useState(false);

  const checkDailyBonus = useCallback((p: PlayerData): PlayerData => {
    const today = todayDateStr();
    if (p.lastLoginDate === today) return p;
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = p.lastLoginDate === yesterday ? Math.min((p.loginStreak ?? 0) + 1, 7) : 1;
    const reward = DAILY_STREAK_REWARDS[newStreak - 1] ?? DAILY_STREAK_REWARDS[0];
    const refreshQuests = p.dailyQuestsDate !== today;
    const updated: PlayerData = {
      ...p,
      coins: p.coins + reward.coins,
      gems: p.gems + reward.gems,
      loginStreak: newStreak,
      lastLoginDate: today,
      dailyQuests: refreshQuests ? makeDailyQuests(undefined, t) : p.dailyQuests,
      dailyQuestsDate: today,
    };
    setDailyBonus({ streak: newStreak, coins: reward.coins, gems: reward.gems });
    return updated;
  }, []);

  // Автовход
  useEffect(() => {
    if (autoLoginDone.current) return;
    autoLoginDone.current = true;
    const fallback = setTimeout(() => { setIsLoading(false); setServerLoadDone(true); }, 5000);

    (async () => {
      try {
        await initYandexGames();
        initI18n();
        const ya = await getYaPlayer();
        const saved = loadProfile();
        let base: PlayerData;

        if (ya) {
          // Загружаем профиль из БД по ya_id — сервер авторитетен
          let serverProfile: PlayerData | null = null;
          try {
            const resp = await apiAuth('load_ya', { yaId: ya.id });
            if (resp.profile) {
              serverProfile = { ...DEFAULT_PLAYER, ...resp.profile, password: '' } as PlayerData;
            }
          } catch { /* ignore */ }

          if (serverProfile) {
            // Сервер авторитетен. Берём данные сервера полностью.
            // Машины берём с сервера если есть, иначе локальные как fallback
            base = {
              ...serverProfile,
              cars: (serverProfile.cars && serverProfile.cars.length > 0)
                ? serverProfile.cars
                : (saved?.cars ?? serverProfile.cars),
            };
          } else {
            // Нет профиля на сервере — используем локальный или создаём новый
            base = (saved && saved.name) ? saved : {
              ...DEFAULT_PLAYER,
              name: (ya.name && ya.name.length >= 2 && ya.name.length <= 16) ? ya.name : 'Игрок',
            };
          }
          setLocalPlayerId(ya.id);
          prefetchFriendCode(ya.id);
        } else if (saved && saved.name) {
          // Анонимный пользователь — загружаем с сервера по anon_id
          try {
            const anonId = getOrCreateAnonId();
            const resp = await apiAuth('load_anon', { playerId: anonId });
            if (resp.profile) {
              const serverScore = (resp.profile.xp ?? 0) + (resp.profile.coins ?? 0);
              const localScore = (saved.xp ?? 0) + (saved.coins ?? 0);
              base = serverScore >= localScore
                ? ({ ...DEFAULT_PLAYER, ...saved, ...resp.profile, password: '' } as PlayerData)
                : saved;
            } else {
              base = saved;
            }
          } catch {
            base = saved;
          }
          prefetchFriendCode(getOrCreateAnonId());
        } else {
          base = { ...DEFAULT_PLAYER, name: 'Игрок' };
          setNeedNickname(true);
        }

        // Проверяем незавершённые покупки (требование Яндекса)
        const restored = await restoreGemPurchases();
        if (restored.restored > 0) {
          base = { ...base, gems: base.gems + restored.restored };
          notify(`${t('notify_restored')} ${restored.restored} 💎 ${t('notify_restored_gems')}`);
        }

        const withBonus = checkDailyBonus(base);
        setPlayer(withBonus);
        saveProfile(withBonus);
      } catch {
        const saved = loadProfile();
        if (saved && saved.name) {
          const withBonus = checkDailyBonus(saved);
          setPlayer(withBonus);
          saveProfile(withBonus);
        }
      } finally {
        clearTimeout(fallback);
        setIsLoading(false);
        setServerLoadDone(true);
        notifyGameReady();
      }
    })();
  }, [checkDailyBonus]);

  // Автосохранение — только после завершения первоначальной загрузки с сервера
  useEffect(() => {
    if (!serverLoadDone) return;
    if (!player.name) return;
    saveProfile(player);
    if (player.password) {
      apiAuth('save', { name: player.name, password: player.password, profile: profileToSavePayload(player) }).catch(() => {});
    } else if (localPlayerId.startsWith('ya_')) {
      apiAuth('save_ya', { yaId: localPlayerId, profile: profileToSavePayload(player) }).catch(() => {});
    } else if (player.name && player.name !== 'Игрок') {
      apiAuth('save_anon', { playerId: getOrCreateAnonId(), profile: profileToSavePayload(player) }).catch(() => {});
    }
  }, [player, localPlayerId, serverLoadDone]);

  const resolvePlayer = useCallback(async (): Promise<{ pid: string; displayName: string } | null> => {
    let pid = localPlayerId;
    let displayName = player.name;

    const savedNick = getSavedNick();
    if (savedNick) {
      displayName = savedNick.name;
      if (savedNick.emoji !== player.emoji) {
        setPlayer(prev => ({ ...prev, emoji: savedNick.emoji }));
      }
    }

    if (!pid) {
      const ya = await getYaPlayer();
      if (ya) {
        pid = ya.id;
        if (!savedNick && (!ya.name || ya.name.length > 16 || ya.name.length < 2)) {
          setLocalPlayerId(pid);
          setNeedNickname(true);
          return null;
        }
        if (!savedNick) displayName = ya.name;
      } else {
        pid = `user_${player.name}`;
      }
      setLocalPlayerId(pid);
    }

    if (!displayName || displayName.length < 2) {
      setNeedNickname(true);
      return null;
    }

    return { pid, displayName };
  }, [localPlayerId, player]);

  return {
    player, setPlayer,
    localPlayerId, setLocalPlayerId,
    isLoading,
    needNickname, setNeedNickname,
    dailyBonus, setDailyBonus,
    resolvePlayer,
  };
}
