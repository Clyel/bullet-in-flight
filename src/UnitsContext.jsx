import React, { createContext, useContext, useState } from "react";

const STORAGE_KEY = "bullet-in-flight:unitSystem";
const UnitsContext = createContext(null);

function readStored() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "metric" ? "metric" : "imperial";
  } catch {
    return "imperial";
  }
}

export function UnitsProvider({ children }) {
  const [system, setSystemState] = useState(readStored);

  const setSystem = (next) => {
    setSystemState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage unavailable — the choice just won't survive a reload.
    }
  };

  return <UnitsContext.Provider value={{ system, setSystem }}>{children}</UnitsContext.Provider>;
}

export function useUnits() {
  const ctx = useContext(UnitsContext);
  if (!ctx) throw new Error("useUnits must be used within a UnitsProvider");
  return ctx;
}
