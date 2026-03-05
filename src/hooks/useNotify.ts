import { useState, useCallback } from 'react';

export function useNotify(duration = 3000) {
  const [notification, setNotification] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), duration);
  }, [duration]);

  return { notification, notify };
}
