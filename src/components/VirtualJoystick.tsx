import { useRef, useEffect, useCallback, MutableRefObject } from 'react';

interface Props {
  keysRef: MutableRefObject<Set<string>>;
}

const HINT_KEY = 'joystick_hint_shown';
const DEAD_ZONE = 0.22; // 22% от радиуса — нечувствительная зона

export default function VirtualJoystick({ keysRef }: Props) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const touchIdRef = useRef<number | null>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());

  // Показываем подсказку только 1 раз
  const hintShown = localStorage.getItem(HINT_KEY) === '1';

  const setKey = useCallback((key: string, active: boolean) => {
    if (active) {
      if (!activeKeysRef.current.has(key)) {
        activeKeysRef.current.add(key);
        keysRef.current.add(key);
      }
    } else {
      activeKeysRef.current.delete(key);
      keysRef.current.delete(key);
    }
  }, [keysRef]);

  const releaseAll = useCallback(() => {
    activeKeysRef.current.forEach(k => keysRef.current.delete(k));
    activeKeysRef.current.clear();
    // Вернуть knob в центр
    const knob = knobRef.current;
    if (knob) {
      knob.style.transform = 'translate(-50%, -50%)';
    }
  }, [keysRef]);

  const applyJoystick = useCallback((dx: number, dy: number) => {
    const knob = knobRef.current;
    const base = baseRef.current;
    if (!knob || !base) return;

    const R = base.offsetWidth / 2;
    const dist = Math.hypot(dx, dy);
    const norm = Math.min(dist, R);
    const clampX = dist > 0 ? dx / dist * norm : 0;
    const clampY = dist > 0 ? dy / dist * norm : 0;

    // Двигаем knob
    knob.style.transform = `translate(calc(-50% + ${clampX}px), calc(-50% + ${clampY}px))`;

    // Нормализуем [-1, 1]
    const nx = clampX / R;
    const ny = clampY / R;

    // Dead zone
    const absX = Math.abs(nx);
    const absY = Math.abs(ny);

    setKey('ArrowUp', ny < -DEAD_ZONE);
    setKey('ArrowDown', ny > DEAD_ZONE);
    setKey('ArrowLeft', nx < -DEAD_ZONE);
    setKey('ArrowRight', nx > DEAD_ZONE);

    // Имитируем нитро если сильно вперёд (>85%)
    if (ny < -0.85 && absX < 0.4) {
      keysRef.current.add(' ');
    } else {
      keysRef.current.delete(' ');
    }
  }, [setKey, keysRef]);

  useEffect(() => {
    const base = baseRef.current;
    if (!base) return;

    const getCenter = () => {
      const rect = base.getBoundingClientRect();
      return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
    };

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (touchIdRef.current !== null) return;
      // Скрыть подсказку при первом касании
      if (hintRef.current) {
        hintRef.current.style.opacity = '0';
        setTimeout(() => {
          if (hintRef.current) hintRef.current.style.display = 'none';
        }, 300);
        localStorage.setItem(HINT_KEY, '1');
      }
      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      const { cx, cy } = getCenter();
      applyJoystick(touch.clientX - cx, touch.clientY - cy);
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (touchIdRef.current === null) return;
      let touch: Touch | undefined;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touch = e.changedTouches[i];
          break;
        }
      }
      if (!touch) return;
      const { cx, cy } = getCenter();
      applyJoystick(touch.clientX - cx, touch.clientY - cy);
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touchIdRef.current = null;
          releaseAll();
          keysRef.current.delete(' ');
          break;
        }
      }
    };

    base.addEventListener('touchstart', onTouchStart, { passive: false });
    base.addEventListener('touchmove', onTouchMove, { passive: false });
    base.addEventListener('touchend', onTouchEnd, { passive: false });
    base.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      base.removeEventListener('touchstart', onTouchStart);
      base.removeEventListener('touchmove', onTouchMove);
      base.removeEventListener('touchend', onTouchEnd);
      base.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyJoystick, releaseAll, keysRef]);

  return (
    <div className="md:hidden shrink-0 flex items-center justify-center pb-3 pt-1 select-none">
      {/* Внешний круг — база джойстика */}
      <div
        ref={baseRef}
        className="relative rounded-full touch-none"
        style={{
          width: 130,
          height: 130,
          background: 'rgba(255,255,255,0.07)',
          border: '2px solid rgba(255,255,255,0.18)',
          boxShadow: '0 0 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* Крестик-ориентир */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ width: 1, height: '60%', background: 'rgba(255,255,255,0.1)', position: 'absolute' }} />
          <div style={{ height: 1, width: '60%', background: 'rgba(255,255,255,0.1)', position: 'absolute' }} />
        </div>

        {/* Стрелки-подсказки на ободке */}
        <div style={{ position: 'absolute', top: 6, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: 12, lineHeight: 1 }}>▲</div>
        <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: 12, lineHeight: 1 }}>▼</div>
        <div style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: 12, lineHeight: 1 }}>◀</div>
        <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.25)', fontSize: 12, lineHeight: 1 }}>▶</div>

        {/* Knob — ручка джойстика */}
        <div
          ref={knobRef}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 52,
            height: 52,
            borderRadius: '50%',
            background: 'radial-gradient(circle at 35% 35%, rgba(255,255,255,0.55), rgba(180,180,220,0.3))',
            border: '2px solid rgba(255,255,255,0.4)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            transition: 'box-shadow 0.1s',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Подсказка при первом запуске */}
      {!hintShown && (
        <div
          ref={hintRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: 10,
            background: 'rgba(0,0,0,0.85)',
            border: '1px solid rgba(255,214,0,0.5)',
            borderRadius: 12,
            padding: '8px 14px',
            color: '#FFD600',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transition: 'opacity 0.3s',
            zIndex: 50,
            animation: 'pulse 1.5s infinite',
          }}
        >
          👆 Управляй джойстиком!
          <div style={{
            position: 'absolute',
            bottom: -7,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '7px solid transparent',
            borderRight: '7px solid transparent',
            borderTop: '7px solid rgba(255,214,0,0.5)',
          }} />
        </div>
      )}
    </div>
  );
}
