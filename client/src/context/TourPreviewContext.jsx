/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useMemo, useState } from "react";

export const TourPreviewContext = createContext({
  currentStepId: null,
  setCurrentStepId: () => {},
  clearPreview: () => {},
});

export function TourPreviewProvider({ children }) {
  const [currentStepId, setCurrentStepId] = useState(null);

  const clearPreview = useCallback(() => {
    setCurrentStepId(null);
  }, []);

  const value = useMemo(
    () => ({ currentStepId, setCurrentStepId, clearPreview }),
    [currentStepId, clearPreview]
  );

  return (
    <TourPreviewContext.Provider value={value}>
      {children}
    </TourPreviewContext.Provider>
  );
}
