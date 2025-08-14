type SidebarButtonProps = {
  label: string;
  tabKey: string;
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

function SidebarButton({ label, tabKey, activeTab, setActiveTab }: SidebarButtonProps) {
  return (
    <button
      className={activeTab === tabKey ? "active" : ""}
      onClick={() => setActiveTab(tabKey)}
    >
      {label}
    </button>
  );
}

export default SidebarButton;