import { useState, useEffect } from 'react';
import { PlayerData, showInterstitialAd, showRewardedAd, isYandexGamesEnv } from './parkingTypes';
import { t } from '@/i18n';
import { CoinIcon } from '@/components/ui/CoinIcon';

interface GameOverScreenProps {
  gameResult: { position: number; coinsEarned: number } | null;
  player: PlayerData;
  onRestart: () => void;
  onMenu: () => void;
  onRewardCoins?: (amount: number) => void;
}

export function GameOverScreen({ gameResult, player, onRestart, onMenu, onRewardCoins }: GameOverScreenProps) {
  const position = gameResult?.position ?? 0;
  const coinsEarned = gameResult?.coinsEarned ?? 0;
  const isWin = position === 1;
  const inYa = isYandexGamesEnv();
  const [rewardLoading, setRewardLoading] = useState(false);
  const [rewardUsed, setRewardUsed] = useState(false);

  useEffect(() => {
    if (gameResult && !isWin) {
      showInterstitialAd();
    }
  }, [gameResult, isWin]);

  if (!gameResult) return null;

  const coinBoost = (player.coinBoostSessions ?? 0) > 0;
  const xpBoost = (player.xpBoostGames ?? 0) > 0;
  const extraLives = player.extraLives ?? 0;

  const handleRewardedAd = async () => {
    if (rewardLoading || rewardUsed) return;
    setRewardLoading(true);
    const rewarded = await showRewardedAd();
    setRewardLoading(false);
    if (rewarded) {
      setRewardUsed(true);
      onRewardCoins?.(100);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card-game-solid p-8 flex flex-col items-center gap-5 w-full max-w-sm animate-bounce-in">
        <div className="text-7xl">{isWin ? '🏆' : position <= 3 ? '🥈' : '😅'}</div>
        <div className="text-center">
          <div className={`font-russo text-4xl ${isWin ? 'text-yellow-400' : 'text-white'}`} style={isWin ? { textShadow: '0 0 20px rgba(255,214,0,0.7)' } : {}}>
            {isWin ? t('victory') : position <= 3 ? t('prize') : `#${position}`}
          </div>
          <div className="text-white/40 font-nunito text-sm mt-1">
            {isWin ? t('win_desc') : position <= 5 ? t('not_bad') : t('park_faster')}
          </div>
        </div>
        <div className="w-full space-y-2">
          <div className="flex justify-between items-center bg-white/5 rounded-2xl p-3">
            <span className="text-white/50 font-nunito text-sm">{t('place')}</span>
            <span className="font-russo text-white">#{position}</span>
          </div>
          <div className="flex justify-between items-center bg-yellow-500/10 rounded-2xl p-3">
            <span className="text-white/50 font-nunito text-sm">{t('coins')}</span>
            <span className="font-russo text-yellow-400">+{coinsEarned} <CoinIcon size={14} /></span>
          </div>
        </div>

        {inYa && !isWin && !rewardUsed && (
          <button
            className="w-full bg-green-500/15 border border-green-500/40 hover:bg-green-500/25 rounded-2xl px-4 py-3 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            onClick={handleRewardedAd}
            disabled={rewardLoading}
          >
            <span className="font-russo text-green-400 text-sm">
              {rewardLoading ? t('rewarded_loading') : t('rewarded_btn')}
            </span>
          </button>
        )}
        {rewardUsed && (
          <div className="w-full bg-green-500/10 border border-green-500/20 rounded-2xl px-4 py-2 text-center">
            <span className="font-russo text-green-400 text-sm">{t('rewarded_ok')}</span>
          </div>
        )}

        {(coinBoost || xpBoost || extraLives > 0) && (
          <div className="w-full bg-white/5 rounded-2xl p-3 flex flex-col gap-1.5">
            <div className="text-white/40 font-nunito text-xs text-center mb-0.5">{t('active_boosts')}</div>
            {coinBoost && (
              <div className="flex items-center justify-between">
                <span className="font-nunito text-xs text-yellow-300">{t('coin_boost_label')}</span>
                <span className="font-russo text-xs text-yellow-400">{player.coinBoostSessions} {t('games_suffix')}</span>
              </div>
            )}
            {xpBoost && (
              <div className="flex items-center justify-between">
                <span className="font-nunito text-xs text-purple-300">{t('xp_boost_label')}</span>
                <span className="font-russo text-xs text-purple-400">{player.xpBoostGames} {t('games_suffix')}</span>
              </div>
            )}
            {extraLives > 0 && (
              <div className="flex items-center justify-between">
                <span className="font-nunito text-xs text-red-300">{t('extra_lives_label')}</span>
                <span className="font-russo text-xs text-red-400">{extraLives} {t('pcs_suffix')}</span>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-3 w-full">
          <button className="btn-yellow flex-1" onClick={onRestart}>{t('play_again')}</button>
          <button className="btn-blue flex-1" onClick={onMenu}>{t('menu')}</button>
        </div>
      </div>
    </div>
  );
}
