import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import "./components/Modals.css";
import SidebarButton from "./components/sidebarButton";
import { tabs, RenderedTabs } from "./tabs";

import { Settings } from "lucide-react"; // icon
import SettingsModal from "./components/SettingsModal";
import type { Config } from "./types/Config";

import type { TabKey } from "./tabs";
import { defaultRefreshCounters, DEFAULT_TAB } from "./tabs";

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
    try {
      const cfg = await invoke<Config>("get_config");
      setInitialConfig(cfg);
    } catch {
      setInitialConfig({ url: "", token: "", alert_period: 180 });
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
        // verify (your Rust command runs in spawn_blocking)
        await invoke("verify_credentials", { url: cfg.url, token: cfg.token });
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
    <div className="app-wrapper">
      <aside className="sidebar">
        {/* nav list */}
        <nav className="sidebar-nav">
          {tabs.map((tab) => (
            <SidebarButton
              key={tab.key}
              label={tab.label}
              tabKey={tab.key}
              activeTab={activeTab}
              setActiveTab={(k) => setActiveTab(k as TabKey)}
            />
          ))}
        </nav>

        {/* settings pinned to bottom */}
        <div className="sidebar-bottom">
          <button
            className="icon-btn settings-btn"
            aria-label="打开设置"
            title="设置"
            onClick={() => openSettings(false)}
          >
            <Settings size={18} />
            <span className="settings-text">设置</span>
          </button>
        </div>
      </aside>

      <main className="content">
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
          if (!lockSettings) setShowSettings(false); // block closing when locked
        }}
        onVerified={() => {
          setLockSettings(false);
          setShowSettings(false);
          setSettingsError(null);
          if (activeTab === "boot") {
            // only switch if we were in boot state
            setActiveTab(DEFAULT_TAB);
          }
        }}
      />
    </div>
  );
}

export default App;
