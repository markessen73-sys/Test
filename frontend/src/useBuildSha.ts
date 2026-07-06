import { useEffect, useState } from 'react';

/** Live build id from /build-info.json (avoids stale Vite compile-time SHA). */
export function useBuildSha(fallback: string): string {
  const [sha, setSha] = useState(fallback);

  useEffect(() => {
    fetch(`/build-info.json?ts=${Date.now()}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.sha) setSha(String(data.sha));
      })
      .catch(() => {});
  }, [fallback]);

  return sha;
}
