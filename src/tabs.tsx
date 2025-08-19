import ProductManagementPane from "./panes/ProductManagement/productManagementPane";
import AddStockPane from "./panes/Stock/AddStockPane";
import RemoveStockPane from "./panes/Stock/RemoveStockPane";
import ViewStockPane from "./panes/Summary/ViewStock";
import AddLoanPane from "./panes/Loan/AddLoanPane";

import './tabs.css'

export type TabKey = 
  | "boot"
  | "viewStock"
  | "addStock"
  | "removeStock"
  | "addLoan"
  | "productManagement";

export const tabs = [
  { key: "viewStock", label: "查看库存" },
  { key: "addStock", label: "添加库存" },
  { key: "removeStock", label: "移除库存" },
  { key: "addLoan", label: "借货/归还" },
  { key: "productManagement", label: "产品信息管理" },
];

export const defaultRefreshCounters = {
    viewStock: 0,
    addStock: 0,
    removeStock: 0,
    addLoan: 0,
    productManagement: 0,
  }

export type RefreshCounters = typeof defaultRefreshCounters;

export function RenderedTabs({
  activeTab,
  refresh,
  triggerRefresh,
}: {
  activeTab: TabKey;
  refresh: RefreshCounters;
  triggerRefresh: (key: keyof typeof refresh) => void;
}) {
  return (
    <>
      {/* boot */}
      <div style={{ display: activeTab === "boot" ? "block" : "none" }}>
        <div style={{ opacity: 0.7, padding: "1rem" }}>
          <h2 style={{ marginTop: 0 }}>正在载入数据…</h2>
          <div>正在检查数据库配置与连接，请稍候。</div>
        </div>
      </div>

      {/* stock summary */}
      <div style={{ display: activeTab === "viewStock" ? "block" : "none", height: "100%" }}>
        <ViewStockPane refreshSignal={refresh.viewStock} />
      </div>

      {/* add stock */}
      <div style={{ display: activeTab === "addStock" ? "block" : "none", height: "100%" }}>
        <AddStockPane
          refreshSignal={refresh.addStock}
          onDidSubmit={() => {
            triggerRefresh("viewStock"); // adding stock affects summary
          }}
        />
      </div>

      {/* remove stock */}
      <div style={{ display: activeTab === "removeStock" ? "block" : "none", height: "100%" }}>
        <RemoveStockPane
          refreshSignal={refresh.removeStock}
          onDidSubmit={() => {
            triggerRefresh("viewStock");
          }}
        />
      </div>

      {/* add loan */}
      <div style={{ display: activeTab === "addLoan" ? "block" : "none", height: "100%" }}>
        <AddLoanPane
          // refreshSignal={refresh.addLoan}
          // onDidSubmit={() => {
          //   triggerRefresh("viewStock"); // loans adjust stock buckets
          // }}
        />
      </div>

      {/* product management */}
      <div style={{ display: activeTab === "productManagement" ? "block" : "none", height: "100%" }}>
        <ProductManagementPane
          // refreshSignal={refresh.productManagement}
          // onDidMutateProduct={() => {
          //   triggerRefresh("viewStock"); // renames/types impact summary display
          // }}
        />
      </div>
    </>
  );
}