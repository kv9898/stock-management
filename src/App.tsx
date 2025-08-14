import { useState } from "react";
import "./App.css";
import SidebarButton from "./components/sidebarButton";
import { tabs, renderTabContent } from "./tabs";

function App() {
  const [activeTab, setActiveTab] = useState("dataAnalysis");

  const [stock, setStock] = useState<
    Array<{ id: string; name: string; quantity: number; expiry: string }>
  >([]);
  const [transactions, setTransactions] = useState<
    Array<{ id: string; type: "add" | "remove"; product: string; date: string }>
  >([]);

  const addStock = (product: {
    name: string;
    quantity: number;
    expiry: string;
  }) => {
    const newStock = [...stock, { ...product, id: Math.random().toString() }];
    setStock(newStock);
    setTransactions([
      ...transactions,
      {
        id: Math.random().toString(),
        type: "add",
        product: product.name,
        date: new Date().toISOString(),
      },
    ]);
  };

  const removeStock = (id: string) => {
    const product = stock.find((item) => item.id === id);
    if (product) {
      setStock(stock.filter((item) => item.id !== id));
      setTransactions([
        ...transactions,
        {
          id: Math.random().toString(),
          type: "remove",
          product: product.name,
          date: new Date().toISOString(),
        },
      ]);
    }
  };

  const getExpiryWarnings = () => {
    const today = new Date();
    return stock.filter((item) => {
      const expiryDate = new Date(item.expiry);
      const diffDays = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return diffDays <= 30;
    });
  };

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
