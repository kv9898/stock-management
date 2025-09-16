import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import "./components/Modals.css";
import "./panes/ProductManagement/productFormModal.css";

import { RenderedTabs, DEFAULT_TAB, defaultRefreshCounters } from "./tabs";
import type { TabKey } from "./tabs";

// import { Settings } from "lucide-react"; // TODO: remove this icon

import SettingsModal from "./components/SettingsModal";
import type { Config } from "./types/Config";

import ResponsiveLayout from "./components/Sidebar/sidebar";


function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("boot");
  const [showSettings, setShowSettings] = useState(false);

  // settings control
  const [lockSettings, setLockSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [initialConfig, setInitialConfig] = useState<Config | null>(null);

  const [refresh, setRefresh] = useState(defaultRefreshCounters);
  const triggerRefresh = (...keys: (keyof typeof refresh)[]) =>
    setRefresh((r) =>
      keys.reduce((acc, k) => ({ ...acc, [k]: acc[k] + 1 }), r)
    );

  // helper to open modal and prefill current config
  const openSettings = async (lock = false, errorMsg?: string) => {
    // only fetch config if not locked (user open)
    if (lock) {
      setInitialConfig({ url: "", token: "", alert_period: 180 });
    } else {
      try {
        const cfg = await invoke<Config>("get_config");
        setInitialConfig(cfg);
      } catch {
        setInitialConfig({ url: "", token: "", alert_period: 180 });
      }
    }
    setSettingsError(errorMsg ?? null);
    setLockSettings(lock);
    setShowSettings(true);
  };

  // On mount: get_config -> verify_credentials; open modal if invalid/missing
  useEffect(() => {
    (async () => {
      try {
        const cfg = await invoke<Config>("get_config");
        setInitialConfig(cfg);

        if (!cfg.url || !cfg.token) throw "配置不完整，请检查。"; // No need to verify empty config

        // verify (your Rust command runs in spawn_blocking)
        await invoke("verify_credentials", { url: cfg.url, token: cfg.token });

        // Valid config -> Refresh all data & switch to default tab
        triggerRefresh(
              "viewStock",
              "dashboard",
              "addStock",
              "removeStock",
              "salesHistory",
              "salesTrend",
              "loanSummary",
              "loanHistory",
              "addLoan",
              "productManagement",
          )
        setActiveTab(DEFAULT_TAB);
      } catch (e: any) {
        // Missing/invalid config -> force modal open & lock
        const msg =
          typeof e === "string" ? e : e?.toString?.() ?? "配置无效，请检查。";
        await openSettings(true, msg);
      }
    })();
  }, []);

  return (
    // <div className=?"app-wrapper">
      
    <ResponsiveLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onOpenSettings={() => openSettings(false)}
    >
      <main className="content" style={{ height: "100%" }}>
        <RenderedTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          refresh={refresh}
          triggerRefresh={triggerRefresh}
        />
      </main>

      <SettingsModal
        open={showSettings}
        locked={lockSettings}
        errorText={settingsError ?? undefined}
        initial={initialConfig ?? { url: "", token: "", alert_period: 180 }}
        onClose={() => {
          if (!lockSettings) setShowSettings(false);
        }}
        onVerified={() => {
          triggerRefresh(
              "viewStock",
              "dashboard",
              "addStock",
              "removeStock",
              "salesHistory",
              "salesTrend",
              "loanSummary",
              "loanHistory",
              "addLoan",
              "productManagement",
          )
          setLockSettings(false);
          setShowSettings(false);
          setSettingsError(null);
          if (activeTab === "boot") setActiveTab(DEFAULT_TAB);
        }}
      />
    </ResponsiveLayout>

    // </di?v>
  );
}

export default App;
