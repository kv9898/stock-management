import { useState } from "react";
import "./App.css";
import SidebarButton from "./components/sidebarButton";
import { tabs, renderTabContent } from "./tabs";

function App() {
  const [activeTab, setActiveTab] = useState("viewStock");

  return (
    <div className="app-wrapper">
      <aside className="sidebar">
        {tabs.map((tab) => (
          <SidebarButton
            key={tab.key}
            label={tab.label}
            tabKey={tab.key}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        ))}
      </aside>

      <main className="content">
        {renderTabContent(activeTab)}
      </main>
    </div>
  );
}

export default App;
