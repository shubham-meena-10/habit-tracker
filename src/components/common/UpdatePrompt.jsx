import { useRegisterSW } from 'virtual:pwa-register/react';

/** Shows "new version" / "ready offline" banners. It never reloads the page on its own. */
export default function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Look for a new version once an hour while the app stays open.
      if (registration) setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    },
  });

  if (needRefresh) {
    return (
      <section className="card update-banner" role="status">
        <div>
          <strong>A new version is ready.</strong>
          <p className="muted small">Finish what you&apos;re doing, then reload. Your data is safe.</p>
        </div>
        <div className="btn-row" style={{ marginTop: 0 }}>
          <button className="btn btn--primary" onClick={() => updateServiceWorker(true)}>Reload</button>
          <button className="btn" onClick={() => setNeedRefresh(false)}>Later</button>
        </div>
      </section>
    );
  }
  if (offlineReady) {
    return (
      <section className="card update-banner" role="status">
        <strong>✓ Ready to work offline.</strong>
        <button className="btn btn--small" onClick={() => setOfflineReady(false)}>OK</button>
      </section>
    );
  }
  return null;
}