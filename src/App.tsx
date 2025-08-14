import { useState } from "react";
import "./App.css";

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
        <h2>📦 Stock Manager</h2>
        <button onClick={() => setActiveTab("dataAnalysis")}>
          数据分析
        </button>
        <button onClick={() => setActiveTab("addStock")}>添加库存</button>
        <button onClick={() => setActiveTab("removeStock")}>
          移除库存
        </button>
        <button onClick={() => setActiveTab("expiryWarnings")}>
          过期预警
        </button>
        <button onClick={() => setActiveTab("transactionHistory")}>
          交易历史
        </button>
      </aside>

      <main className="content">
        {activeTab === "dataAnalysis" && (
          <div>
            <h2>数据分析</h2>
            {/* Charts */}
          </div>
        )}

        {activeTab === "addStock" && (
          <div>
            <h2>添加库存</h2>
            {/* Form to add stock goes here */}
          </div>
        )}

        {activeTab === "removeStock" && (
          <div>
            <h2>移出库存</h2>
            {/* Form to remove stock */}
          </div>
        )}

        {activeTab === "expiryWarnings" && (
          <div>
            <h2>过期预警</h2>
            <ul>
              {getExpiryWarnings().map((item) => (
                <li key={item.id}>
                  {item.name} - Expires on {item.expiry}
                </li>
              ))}
            </ul>
          </div>
        )}

        {activeTab === "transactionHistory" && (
          <div>
            <h2>交易历史</h2>
            <ul>
              {transactions.map((tx) => (
                <li key={tx.id}>
                  {tx.date}: {tx.type === "add" ? "Added" : "Removed"}{" "}
                  {tx.product}
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
