import ProductManagementPane from "./components/ProductManagement/productManagementPane";
import AddStockPane from "./components/Stock/AddStockPane";
import RemoveStockPane from "./components/Stock/RemoveStockPane";

import './tabs.css'

export const tabs = [
  { key: "dataAnalysis", label: "数据分析" },
  { key: "addStock", label: "添加库存" },
  { key: "removeStock", label: "移除库存" },
  { key: "expiryWarnings", label: "过期预警" },
  { key: "productManagement", label: "产品信息管理" },
];

export const renderTabContent = (activeTab: string) => {
  switch (activeTab) {
    case "dataAnalysis":
      return <h2>数据分析</h2>;
    case "addStock":
      return <AddStockPane />;
    case "removeStock":
      return <RemoveStockPane />;
    case "expiryWarnings":
      return (
        <>
          <h2>过期预警</h2>
          {/* <ul>
            {getExpiryWarnings().map((item) => (
              <li key={item.id}>
                {item.name} - Expires on {item.expiry}
              </li>
            ))}
          </ul> */}
        </>
      );
    case "productManagement":
      return <ProductManagementPane />;
    default:
      return <h2>未知标签</h2>;
  }
};

