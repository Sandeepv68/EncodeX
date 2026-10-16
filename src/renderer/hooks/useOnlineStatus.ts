/**
 * @fileoverview Hook that reports whether the browser thinks it is online.
 *
 * Uses `navigator.onLine` and `online`/`offline` window events. This is the
 * standard approach for disabling network-dependent UI when the device has no
 * internet connection.
 */

import { useEffect, useState } from 'react';

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}
