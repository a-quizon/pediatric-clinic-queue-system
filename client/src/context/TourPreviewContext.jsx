/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useMemo, useState } from "react";

export const TourPreviewContext = createContext({
  currentStepId: null,
  setCurrentStepId: () => {},
  clearPreview: () => {},
  replayRole: null,
  startTourReplay: () => {},
  clearReplay: () => {},
});

export function TourPreviewProvider({ children }) {
  const [currentStepId, setCurrentStepId] = useState(null);
  const [replayRole, setReplayRole] = useState(null);

  const clearPreview = useCallback(() => {
    setCurrentStepId(null);
  }, []);

  const startTourReplay = useCallback((role) => {
    setReplayRole(role || null);
  }, []);

  const clearReplay = useCallback(() => {
    setReplayRole(null);
  }, []);

  const value = useMemo(
    () => ({
      currentStepId,
      setCurrentStepId,
      clearPreview,
      replayRole,
      startTourReplay,
      clearReplay,
    }),
    [currentStepId, clearPreview, replayRole, startTourReplay, clearReplay]
  );

  return (
    <TourPreviewContext.Provider value={value}>
      {children}
    </TourPreviewContext.Provider>
  );
}
