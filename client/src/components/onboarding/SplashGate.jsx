import { useEffect, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import SplashScreen from "./SplashScreen";

const SPLASH_MS = 1400;
const SPLASH_REDUCED_MS = 400;

export default function SplashGate({ children }) {
  const { loading } = useAuth();
  const [minElapsed, setMinElapsed] = useState(false);

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

  if (!minElapsed || loading) {
    return <SplashScreen />;
  }

  return children;
}
