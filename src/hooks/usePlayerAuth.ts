import { useState, useEffect, useRef, useCallback } from 'react';
import {
  PlayerData, DEFAULT_PLAYER, FRIENDS_URL,
  loadProfile, saveProfile, profileToSavePayload,
  apiAuth, getYaPlayer, initYandexGames, notifyGameReady, getOrCreateAnonId,
  DAILY_STREAK_REWARDS, makeDailyQuests, makeWeeklyQuests, todayDateStr, weeklyDateStr, restoreGemPurchases,
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

// Явно сохраняет профиль на сервер — вызывается только после загрузки серверных данных
function persistToServer(pid: string, p: PlayerData) {
  if (!p.name) return;
  saveProfile(p);
  if (p.password) {
    apiAuth('save', { name: p.name, password: p.password, profile: profileToSavePayload(p) }).catch(() => {});
  } else if (pid.startsWith('ya_')) {
    apiAuth('save_ya', { yaId: pid, profile: profileToSavePayload(p) }).catch(() => {});
  } else if (p.name && p.name !== 'Игрок') {
    apiAuth('save_anon', { playerId: getOrCreateAnonId(), profile: profileToSavePayload(p) }).catch(() => {});
  }
}

export function usePlayerAuth(notify: (msg: string) => void) {
  const [player, setPlayer] = useState<PlayerData>(() => loadProfile() ?? DEFAULT_PLAYER);
  const [localPlayerId, setLocalPlayerId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [needNickname, setNeedNickname] = useState(false);
  const [dailyBonus, setDailyBonus] = useState<{ streak: number; coins: number; gems: number } | null>(null);
  const autoLoginDone = useRef(false);

  // После загрузки сервера сохраняем pid здесь — автосохранение использует ref, не state
  const pidRef = useRef('');
  const serverLoadDone = useRef(false);

  const relabelQuests = useCallback((p: PlayerData): PlayerData => {
    const today = todayDateStr();
    const thisWeek = weeklyDateStr();
    let result = { ...p };

    if (p.dailyQuestsDate === today && p.dailyQuests?.length) {
      const fresh = makeDailyQuests(today, t);
      result = {
        ...result,
        dailyQuests: p.dailyQuests.map(q => {
          const f = fresh.find(fq => fq.id === q.id);
          return f ? { ...q, label: f.label } : q;
        }),
      };
    }

    if (p.weeklyQuestsDate === thisWeek && p.weeklyQuests?.length) {
      const fresh = makeWeeklyQuests(thisWeek, t);
      result = {
        ...result,
        weeklyQuests: p.weeklyQuests.map(q => {
          const f = fresh.find(fq => fq.id === q.id);
          return f ? { ...q, label: f.label } : q;
        }),
      };
    }

    return result;
  }, []);

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
    const fallback = setTimeout(() => {
      serverLoadDone.current = true;
      setIsLoading(false);
      notifyGameReady();
    }, 8000);

    (async () => {
      try {
        await initYandexGames();
        initI18n();
        const ya = await getYaPlayer();
        console.log('[Auth] getYaPlayer result:', ya);
        const saved = loadProfile() ? relabelQuests(loadProfile()!) : null;
        console.log('[Auth] saved local profile name:', saved?.name);
        let base: PlayerData;
        let pid = '';

        if (ya) {
          pid = ya.id;
          // Загружаем профиль с сервера — он авторитетен
          let serverProfile: PlayerData | null = null;
          try {
            const resp = await apiAuth('load_ya', { yaId: ya.id });
            console.log('[Auth] load_ya response:', resp?.profile ? `profile found: ${resp.profile.name}` : 'no profile');
            if (resp.profile) {
              serverProfile = { ...DEFAULT_PLAYER, ...resp.profile, password: '' } as PlayerData;
            }
          } catch (e) {
            console.log('[Auth] load_ya fetch error:', e);
          }

          if (serverProfile) {
            base = {
              ...serverProfile,
              cars: (serverProfile.cars && serverProfile.cars.length > 0)
                ? serverProfile.cars
                : (saved?.cars ?? serverProfile.cars),
            };
          } else {
            base = (saved && saved.name) ? saved : {
              ...DEFAULT_PLAYER,
              name: (ya.name && ya.name.length >= 2 && ya.name.length <= 16) ? ya.name : 'Игрок',
            };
          }
          prefetchFriendCode(ya.id);
        } else if (saved && saved.name) {
          console.log('[Auth] no ya player, using anon path');
          pid = getOrCreateAnonId();
          try {
            const resp = await apiAuth('load_anon', { playerId: pid });
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
          prefetchFriendCode(pid);
        } else {
          base = { ...DEFAULT_PLAYER, name: 'Игрок' };
          setNeedNickname(true);
        }

        // Восстанавливаем незавершённые покупки Яндекса
        const restored = await restoreGemPurchases();
        if (restored.restored > 0) {
          base = { ...base, gems: base.gems + restored.restored };
          notify(`${t('notify_restored')} ${restored.restored} 💎 ${t('notify_restored_gems')}`);
        }

        const withBonus = checkDailyBonus(base);
        const withLabels = relabelQuests(withBonus);

        // Сначала сохраняем pid и флаг — потом setState
        console.log('[Auth] final pid:', pid, 'profile name:', withLabels.name, 'gems:', withLabels.gems);
        pidRef.current = pid;
        serverLoadDone.current = true;

        // Явно сохраняем уже загруженный профиль на сервер
        persistToServer(pid, withLabels);

        // Обновляем UI
        setLocalPlayerId(pid);
        setPlayer(withLabels);
        saveProfile(withLabels);
      } catch {
        const saved = loadProfile();
        if (saved && saved.name) {
          const withBonus = checkDailyBonus(saved);
          setPlayer(withBonus);
          saveProfile(withBonus);
        }
        serverLoadDone.current = true;
      } finally {
        clearTimeout(fallback);
        setIsLoading(false);
        notifyGameReady();
      }
    })();
  }, [checkDailyBonus, relabelQuests]);

  // Автосохранение — только когда сервер уже загружен (serverLoadDone.current = true)
  // Используем ref чтобы избежать race condition с первым рендером
  const prevPlayerRef = useRef<PlayerData | null>(null);
  useEffect(() => {
    // Игнорируем первый рендер (до загрузки сервера) и неизменившийся state
    if (!serverLoadDone.current) return;
    if (prevPlayerRef.current === player) return;
    prevPlayerRef.current = player;

    if (!player.name) return;
    saveProfile(player);
    persistToServer(pidRef.current || localPlayerId, player);
  }, [player, localPlayerId]);

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
          pidRef.current = pid;
          setNeedNickname(true);
          return null;
        }
        if (!savedNick) displayName = ya.name;
      } else {
        pid = `user_${player.name}`;
      }
      setLocalPlayerId(pid);
      pidRef.current = pid;
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