import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { hasApiUrl, isApiConfigured } from '../../config';
import { useAppState } from '../../store/AppContext';

/** Explains why nothing syncs when the URL or token is missing, instead of leaving the app looking empty. */
export default function ConfigBanner() {
  const { ready } = useAppState();
  const [, bump] = useState(0);

  useEffect(() => {
    const f = () => bump((n) => n + 1);
    window.addEventListener('token-changed', f);
    return () => window.removeEventListener('token-changed', f);
  }, []);

  if (!ready || isApiConfigured()) return null;
  return (
    <section className="card warn-card" role="status" aria-label="Not connected">
      <strong>Not connected to your Sheet yet</strong>
      <p className="small">
        {hasApiUrl()
          ? 'This device has no access token. Paste it under Settings → Access.'
          : 'The Apps Script URL is not set. Add VITE_GOOGLE_APPS_SCRIPT_URL to .env and rebuild.'}
        {' '}Everything you log is still saved on this device.
      </p>
      <Link className="btn btn--small" to="/settings">Open Settings</Link>
    </section>
  );
}