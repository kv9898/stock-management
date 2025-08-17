import ProductManagementPane from "./components/ProductManagement/productManagementPane";
import AddStockPane from "./components/Stock/AddStockPane";
import RemoveStockPane from "./components/Stock/RemoveStockPane";
import ViewStockTab from "./components/Summary/ViewStock";

import './tabs.css'

export const tabs = [
  { key: "viewStock", label: "查看库存" },
  { key: "addStock", label: "添加库存" },
  { key: "removeStock", label: "移除库存" },
  { key: "expiryWarnings", label: "过期预警" },
  { key: "productManagement", label: "产品信息管理" },
];

export const renderTabContent = (activeTab: string) => {
  switch (activeTab) {
    case "viewStock":
      return <ViewStockTab />;
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

