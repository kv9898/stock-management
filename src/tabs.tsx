import ProductManagementPane from "./panes/ProductManagement/productManagementPane";
import AddStockPane from "./panes/Stock/AddStockPane";
import RemoveStockPane from "./panes/Stock/RemoveStockPane";
import ViewStockPane from "./panes/Summary/ViewStock";

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
    case "boot":
      return (
        <div style={{ opacity: 0.7, padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>正在载入数据…</h2>
          <div>正在检查数据库配置与连接，请稍候。</div>
        </div>
      );
    case "viewStock":
      return <ViewStockPane />;
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

