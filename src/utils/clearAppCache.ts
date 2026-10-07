export async function clearAppCache(): Promise<void> {
  const jobs: Promise<unknown>[] = [];
  if ('caches' in window) {
    jobs.push(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  }
  if ('serviceWorker' in navigator) {
    jobs.push(
      navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister()))),
    );
  }
  await Promise.all(jobs);
  const next = new URL(window.location.href);
  next.searchParams.set('v', String(Date.now()));
  window.location.replace(next.href);
}
