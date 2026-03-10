import { useState } from 'react';
import { PlayerData, Screen, DailyQuest, WeeklyQuest, todayDateStr, weeklyDateStr, xpForLevel } from './parkingTypes';
import { t } from '@/i18n';
import { PrivacyPolicyModal } from './LoginScreen';
import { CoinIcon, GemIcon } from '@/components/ui/CoinIcon';

interface MenuScreenProps {
  player: PlayerData;
  setScreen: (s: Screen) => void;
  onPlay: () => void;
  onPlayWithFriends?: () => void;
  onQuestClaim?: (questId: string) => void;
  onWeeklyQuestClaim?: (questId: string) => void;
}

export function MenuScreen({ player, setScreen, onPlay, onPlayWithFriends, onQuestClaim, onWeeklyQuestClaim }: MenuScreenProps) {
  const today = todayDateStr();
  const thisWeek = weeklyDateStr();
  const [questTab, setQuestTab] = useState<'daily' | 'weekly'>('daily');
  const [showPrivacy, setShowPrivacy] = useState(false);

  const quests: DailyQuest[] = player.dailyQuestsDate === today ? (player.dailyQuests ?? []) : [];
  const weeklyQuests: WeeklyQuest[] = player.weeklyQuestsDate === thisWeek ? (player.weeklyQuests ?? []) : [];
  const hasClaimableDaily = quests.some(q => q.progress >= q.goal && !q.claimed);
  const hasClaimableWeekly = weeklyQuests.some(q => q.progress >= q.goal && !q.claimed);
  const streak = player.loginStreak ?? 0;

  const xpIntoLevel = (() => {
    let rem = player.xp;
    let l = 1;
    while (rem >= xpForLevel(l)) { rem -= xpForLevel(l); l++; }
    return { current: rem, needed: xpForLevel(l) };
  })();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[
          { em: '🚗', t: 'top-10 left-10', d: '0s' }, { em: '🏎️', t: 'top-20 right-16', d: '1s' },
          { em: '🚕', t: 'bottom-20 left-20', d: '2s' }, { em: '🚙', t: 'bottom-16 right-12', d: '0.5s' },
        ].map((item, i) => (
          <div key={i} className={`absolute text-5xl animate-float ${item.t}`} style={{ animationDelay: item.d }}>{item.em}</div>
        ))}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-yellow-500/5 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-orange-500/5 blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-4 w-full max-w-sm py-6">
        <div className="text-center animate-fade-in">
          <div className="text-7xl mb-2 animate-bounce-in">👑</div>
          <h1 className="font-russo text-4xl text-yellow-400 leading-none" style={{ textShadow: '0 0 30px rgba(255,214,0,0.6)' }}>{t('title')}</h1>
        </div>

        <button className="card-game p-3 flex items-center gap-3 w-full animate-fade-in hover:border-yellow-400/30 transition-all" onClick={() => setScreen('profile')}>
          <span className="text-3xl">{player.emoji}</span>
          <div className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-2">
              <div className="font-russo text-white text-sm">{player.name}</div>
              <div className="font-russo text-yellow-400 text-sm">Lv.{player.level}</div>
              {streak > 0 && <div className="text-orange-400 text-xs font-nunito">🔥 {streak}</div>}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="coin-badge text-xs"><CoinIcon size={13} /> {player.coins.toLocaleString()}</span>
              <span className="gem-badge text-xs"><GemIcon size={13} /> {player.gems}</span>
            </div>
            <div className="mt-1.5">
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (xpIntoLevel.current / xpIntoLevel.needed) * 100)}%` }}
                />
              </div>
              <div className="text-white/30 text-[10px] font-nunito mt-0.5">{xpIntoLevel.current} / {xpIntoLevel.needed} XP</div>
            </div>
          </div>
        </button>

        {(quests.length > 0 || weeklyQuests.length > 0) && (
          <div className="card-game w-full p-3 animate-fade-in">
            <div className="flex items-center gap-1 mb-2.5">
              <button
                onClick={() => setQuestTab('daily')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-russo transition-all ${questTab === 'daily' ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'text-white/40 hover:text-white/60'}`}
              >
                {t('daily_quests')}
                {hasClaimableDaily && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 inline-block" />}
              </button>
              <button
                onClick={() => setQuestTab('weekly')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-russo transition-all ${questTab === 'weekly' ? 'bg-purple-400/20 text-purple-300 border border-purple-400/30' : 'text-white/40 hover:text-white/60'}`}
              >
                {t('weekly_quests')}
                {hasClaimableWeekly && <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block" />}
              </button>
            </div>

            {questTab === 'daily' && (
              <div className="flex flex-col gap-1.5">
                {quests.map(q => {
                  const pct = Math.min(100, (q.progress / q.goal) * 100);
                  const canClaim = q.progress >= q.goal && !q.claimed;
                  return (
                    <div key={q.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${q.claimed ? 'bg-green-500/10 border border-green-500/20 opacity-60' : canClaim ? 'bg-yellow-400/10 border border-yellow-400/30' : 'bg-white/5'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`font-nunito text-xs ${q.claimed ? 'text-green-400' : canClaim ? 'text-yellow-300' : 'text-white/70'}`}>{q.label}</span>
                          <span className="ml-auto font-nunito text-white/40 text-xs whitespace-nowrap">{q.progress}/{q.goal}</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-yellow-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                      {q.claimed ? (
                        <div className="shrink-0 text-green-400 text-xs">✅</div>
                      ) : canClaim ? (
                        <button className="shrink-0 bg-yellow-400 text-gray-900 font-russo text-xs px-2 py-1 rounded-lg hover:bg-yellow-300 transition-all whitespace-nowrap" onClick={() => onQuestClaim?.(q.id)}>
                          {t('claim')}
                        </button>
                      ) : (
                        <div className="shrink-0 text-xs font-nunito text-yellow-400/60 whitespace-nowrap flex items-center gap-0.5">+{q.reward.coins}<CoinIcon size={12} />{q.reward.gems ? <>{' '}+{q.reward.gems}<GemIcon size={12} /></> : ''}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {questTab === 'weekly' && (
              <div className="flex flex-col gap-1.5">
                {weeklyQuests.length === 0 && (
                  <div className="text-white/30 text-xs font-nunito text-center py-2">{t('weekly_quests_start')}</div>
                )}
                {weeklyQuests.map(q => {
                  const pct = Math.min(100, (q.progress / q.goal) * 100);
                  const canClaim = q.progress >= q.goal && !q.claimed;
                  return (
                    <div key={q.id} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${q.claimed ? 'bg-green-500/10 border border-green-500/20 opacity-60' : canClaim ? 'bg-purple-400/10 border border-purple-400/30' : 'bg-white/5'}`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className={`font-nunito text-xs ${q.claimed ? 'text-green-400' : canClaim ? 'text-purple-300' : 'text-white/70'}`}>{q.label}</span>
                          <span className="ml-auto font-nunito text-white/40 text-xs whitespace-nowrap">{q.progress}/{q.goal}</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-purple-500 to-purple-300 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-purple-400/60 text-[10px] font-nunito mt-0.5 flex items-center gap-0.5">+{q.reward.coins}<CoinIcon size={12} /> +{q.reward.gems}<GemIcon size={12} /></div>
                      </div>
                      {q.claimed ? (
                        <div className="shrink-0 text-green-400 text-xs">✅</div>
                      ) : canClaim ? (
                        <button className="shrink-0 bg-purple-500 text-white font-russo text-xs px-2 py-1 rounded-lg hover:bg-purple-400 transition-all whitespace-nowrap" onClick={() => onWeeklyQuestClaim?.(q.id)}>
                          {t('claim')}
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 w-full">
          <button className="btn-yellow w-full text-xl py-5 animate-fade-in" onClick={onPlay}>
            {t('play')}
          </button>
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-blue animate-fade-in" onClick={() => setScreen('garage')}>{t('garage')}</button>
            <button className="btn-purple animate-fade-in" onClick={() => setScreen('shop')}>{t('shop')}</button>
            <button className="btn-orange animate-fade-in" onClick={() => setScreen('profile')}>{t('profile')}</button>
            <button className="btn-green animate-fade-in" onClick={() => setScreen('leaderboard')}>{t('leaderboard')}</button>
            <button className="col-span-2 animate-fade-in card-game py-2.5 flex items-center justify-center gap-2 hover:border-yellow-400/30 transition-all" onClick={() => setScreen('friends')}>
              <span className="font-russo text-white/70 text-sm">{t('friends')}</span>
              <span className="text-white/30 text-xs ml-1">{t('friends_bonus')}</span>
            </button>
          </div>
        </div>

        <button
          className="text-white/20 text-xs font-nunito hover:text-white/40 transition-colors"
          onClick={() => setShowPrivacy(true)}
        >
          {t('privacy_policy')} · v1.0
        </button>
      </div>
      {showPrivacy && <PrivacyPolicyModal onClose={() => setShowPrivacy(false)} />}
    </div>
  );
}
