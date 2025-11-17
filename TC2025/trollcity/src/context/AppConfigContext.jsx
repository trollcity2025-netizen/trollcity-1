import React from "react";

export function useAppConfig() {
  const [config, setConfig] = React.useState(null);

  const applyLocalConfig = (cfg) => {
    try {
      localStorage.setItem("app_config:global", JSON.stringify(cfg));
      setConfig(cfg);
    } catch (_) {
      // no-op
    }
  };

  const refresh = async () => {
    try {
      const raw = localStorage.getItem("app_config:global");
      const parsed = raw ? JSON.parse(raw) : null;
      setConfig(parsed);
      return parsed;
    } catch (_) {
      setConfig(null);
      return null;
    }
  };

  return { config, applyLocalConfig, refresh };
}

export function AppConfigProvider({ children }) {
  // Simple provider to allow future expansion; not strictly required by current usage
  return <>{children}</>;
}

