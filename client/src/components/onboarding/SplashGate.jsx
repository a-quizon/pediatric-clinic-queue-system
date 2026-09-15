import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import SplashScreen from "./SplashScreen";

const SPLASH_MS = 1400;
const SPLASH_REDUCED_MS = 400;

export default function SplashGate({ children }) {
  const { loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);
  const [hasBooted, setHasBooted] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(
      () => setMinElapsed(true),
      reduced ? SPLASH_REDUCED_MS : SPLASH_MS
    );
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (minElapsed && !loading) {
      setHasBooted(true);
    }
  }, [minElapsed, loading]);

  // Only splash on first boot. Later auth loading (login/register) must not
  // unmount the current route — that remounts /register and flashes the phone step.
  if (!hasBooted) {
    return <SplashScreen />;
  }

  return children;
}
