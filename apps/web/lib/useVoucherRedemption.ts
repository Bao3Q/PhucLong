'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { fetchVoucherRedemption } from './api';
import { getToken, subscribeToken } from './auth';

const emptyCodes: readonly string[] = [];

export function useVoucherRedemption(): readonly string[] {
  const token = useSyncExternalStore(subscribeToken, getToken, () => null);
  const [redemption, setRedemption] = useState<{ token: string; codes: string[] } | null>(null);

  useEffect(() => {
    if (!token) {
      setRedemption(null);
      return;
    }

    let active = true;
    void fetchVoucherRedemption().then((result) => {
      if (active && result.ok && Array.isArray(result.data.usedCodes)) {
        setRedemption({ token, codes: result.data.usedCodes });
      }
    });
    return () => { active = false; };
  }, [token]);

  return redemption?.token === token ? redemption.codes : emptyCodes;
}
