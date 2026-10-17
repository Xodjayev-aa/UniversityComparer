import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const displayModeStandalone =
    typeof window.matchMedia === 'function' ? window.matchMedia('(display-mode: standalone)').matches : false;
  return displayModeStandalone || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function InstallPrompt({ variant = 'header' }: { variant?: 'header' | 'footer' | 'page' }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (installed) {
    return variant === 'header' ? null : <span className="install-note">Installed on this device</span>;
  }

  if (variant === 'page') {
    if (deferred) {
      return (
        <div className="install-card">
          <div>
            <h2>Install on this device</h2>
            <p>Adds a home-screen icon and caches the app shell. Search and profiles still need a connection.</p>
          </div>
          <button
            type="button"
            className="button"
            onClick={async () => {
              await deferred.prompt();
              const choice = await deferred.userChoice;
              setMessage(choice.outcome === 'accepted' ? 'Installing UniScope.' : 'Installation dismissed.');
              setDeferred(null);
            }}
          >
            Install app
          </button>
          <span className="visually-hidden" role="status">{message}</span>
        </div>
      );
    }
    return (
      <div className="install-card install-card--muted">
        <div>
          <h2>{isIos() ? 'Install from Safari' : 'Installation is not offered by this browser right now'}</h2>
          <p>
            {isIos()
              ? 'Use the Share menu, then “Add to Home Screen”.'
              : 'Use the browser menu’s “Install app” or “Add to Home screen” option if available. Details are below.'}
          </p>
        </div>
      </div>
    );
  }

  if (deferred) {
    return (
      <button
        type="button"
        className={variant === 'header' ? 'button button--ghost button--small' : 'text-link'}
        onClick={async () => {
          await deferred.prompt();
          const choice = await deferred.userChoice;
          setMessage(choice.outcome === 'accepted' ? 'Installing UniScope.' : 'Installation dismissed.');
          setDeferred(null);
        }}
      >
        <span aria-hidden="true">↓</span> Install app
        <span className="visually-hidden" role="status">{message}</span>
      </button>
    );
  }

  if (isIos()) {
    return variant === 'header' ? (
      <Link className="button button--ghost button--small" to="/install">
        Install app
      </Link>
    ) : (
      <Link className="text-link" to="/install">
        Install on iPhone or iPad
      </Link>
    );
  }

  return variant === 'header' ? null : (
    <Link className="text-link" to="/install">
      How to install
    </Link>
  );
}
