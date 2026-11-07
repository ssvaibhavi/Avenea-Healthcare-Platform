import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ClerkProvider, useAuth } from "@clerk/react";
import { setTokenGetter } from "@/lib/api";

// Avenea's editorial palette applied to Clerk's own card (variables only, card left intact).
const appearance = {
  variables: {
    colorPrimary: "#8A4A67",
    colorPrimaryForeground: "#FFF8F6",
    colorBackground: "#FFF8F6",
    colorForeground: "#382B33",
    colorInput: "#FFFFFF",
    colorInputForeground: "#382B33",
    colorBorder: "#E9D4DD",
    fontFamily: "'Plus Jakarta Sans Variable', ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.9rem",
  },
};

interface ClerkConfig {
  enabled: boolean;
  publishable_key: string;
  proxy_url: string;
}

/** Hands Clerk's short-lived session token to the typed fetch layer. */
function TokenBridge({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn } = useAuth();
  useEffect(() => {
    setTokenGetter(isSignedIn ? () => getToken() : null);
  }, [getToken, isSignedIn]);
  return <>{children}</>;
}

// Starts Clerk from the backend's runtime config, so deploy's live keys need no rebuild.
export default function ClerkAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [config, setConfig] = useState<ClerkConfig | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async (attempt = 0) => {
      try {
        const cfg = (await (await fetch("/api/clerk/config")).json()) as ClerkConfig;
        if (cfg.enabled) {
          if (!cancelled) setConfig(cfg);
          return;
        }
      } catch {
        /* backend restarting — retry */
      }
      if (cancelled) return;
      if (attempt >= 20) return setUnavailable(true);
      setTimeout(() => load(attempt + 1), 1500);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (unavailable) return <p style={{ padding: 24 }}>Sign-in is unavailable right now. Refresh the page to try again.</p>;
  if (!config) return null;
  return (
    <ClerkProvider
      publishableKey={config.publishable_key}
      proxyUrl={config.proxy_url || undefined}
      appearance={appearance}
      routerPush={(to: string) => navigate(to)}
      routerReplace={(to: string) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/patients"
      signUpFallbackRedirectUrl="/patients"
      afterSignOutUrl="/"
    >
      <TokenBridge>{children}</TokenBridge>
    </ClerkProvider>
  );
}
