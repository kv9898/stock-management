import { useState } from "react";
import "./App.css";
import SidebarButton from "./components/sidebarButton";
import { tabs, renderTabContent } from "./tabs";

import { Settings } from "lucide-react"; // icon
import SettingsModal from "./components/SettingsModal";

function App() {
  const [activeTab, setActiveTab] = useState("viewStock");
  const [showSettings, setShowSettings] = useState(false);

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
              setActiveTab={setActiveTab}
            />
          ))}
        </nav>

        {/* settings pinned to bottom */}
        <div className="sidebar-bottom">
          <button
            className="icon-btn settings-btn"
            aria-label="打开设置"
            title="设置"
            onClick={() => setShowSettings(true)}
          >
            <Settings size={18} />
            <span className="settings-text">设置</span>
          </button>
        </div>
      </aside>

      <main className="content">{renderTabContent(activeTab)}</main>

      <SettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
}

export default App;
