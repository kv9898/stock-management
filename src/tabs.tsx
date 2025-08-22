import ProductManagementPane from "./panes/ProductManagement/productManagementPane";
import AddStockPane from "./panes/Stock/AddStockPane";
import RemoveStockPane from "./panes/Stock/RemoveStockPane";
import ViewStockPane from "./panes/Summary/ViewStock";
import AddLoanPane from "./panes/Loan/AddLoanPane";
import DashboardPane from "./panes/Dashboard/DashboardPane";
import LoanHistoryPane from "./panes/Loan/LoanHistoryPane";
import LoanSummaryPane from "./panes/Loan/LoanSummaryPane";

import "./tabs.css";

export const DEFAULT_TAB = "dashboard";

export type TabKey =
  | "boot"
  | "dashboard"
  | "viewStock"
  | "addStock"
  | "removeStock"
  | "loanSummary"
  | "loanHistory"
  | "addLoan"
  | "productManagement";

export const tabs = [
  { key: "viewStock", label: "查看库存" },
  { key: "dashboard", label: "价值总览" }, // not implemented yet
  { key: "addStock", label: "添加库存" },
  { key: "removeStock", label: "移除库存" },
  { key: "loanSummary", label: "借货总览" },
  { key: "loanHistory", label: "借货记录" },
  { key: "addLoan", label: "新增借货/归还" },
  { key: "productManagement", label: "产品信息管理" },
];

export const defaultRefreshCounters = {
  viewStock: 0,
  dashboard: 0,
  addStock: 0,
  removeStock: 0,
  loanSummary: 0,
  loanHistory: 0,
  addLoan: 0,
  productManagement: 0,
};

export type RefreshCounters = typeof defaultRefreshCounters;

export function RenderedTabs({
  activeTab,
  refresh,
  triggerRefresh,
}: {
  activeTab: TabKey;
  refresh: RefreshCounters;
  triggerRefresh: (...keys: (keyof typeof refresh)[]) => void;
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

      {/* dashboard */}
      <div
        style={{
          display: activeTab === "dashboard" ? "block" : "none",
          height: "100%",
        }}
      >
        <DashboardPane
          refreshSignal={refresh.dashboard}
          onRefresh={() =>
            triggerRefresh("viewStock", "addStock", "removeStock", "addLoan")
          }
        />
      </div>

      {/* stock summary */}
      <div
        style={{
          display: activeTab === "viewStock" ? "block" : "none",
          height: "100%",
        }}
      >
        <ViewStockPane refreshSignal={refresh.viewStock} />
      </div>

      {/* add stock */}
      <div
        style={{
          display: activeTab === "addStock" ? "block" : "none",
          height: "100%",
        }}
      >
        <AddStockPane
          refreshSignal={refresh.addStock}
          onDidSubmit={() => {
            triggerRefresh("viewStock", "dashboard"); // adding stock affects summary
          }}
        />
      </div>

      {/* remove stock */}
      <div
        style={{
          display: activeTab === "removeStock" ? "block" : "none",
          height: "100%",
        }}
      >
        <RemoveStockPane
          refreshSignal={refresh.removeStock}
          onDidSubmit={() => {
            triggerRefresh("viewStock", "dashboard");
          }}
        />
      </div>

      {/* loan summary */}
      <div
        style={{
          display: activeTab === "loanSummary" ? "block" : "none",
          height: "100%",
        }}
      >
        <LoanSummaryPane refreshSignal={refresh.loanSummary} />
      </div>

      {/* loan history */}
      <div
        style={{
          display: activeTab === "loanHistory" ? "block" : "none",
          height: "100%",
        }}
      >
        <LoanHistoryPane
          refreshSignal={refresh.loanHistory}
          onDidSubmit={() => {
            triggerRefresh("viewStock", "loanSummary", "removeStock", "dashboard"); // loans impact stock buckets
          }}
        />
      </div>

      {/* add loan */}
      <div
        style={{
          display: activeTab === "addLoan" ? "block" : "none",
          height: "100%",
        }}
      >
        <AddLoanPane
          refreshSignal={refresh.addLoan}
          onDidSubmit={() => {
            triggerRefresh(
              "viewStock",
              "removeStock",
              "loanSummary",
              "loanHistory",
              "dashboard"
            ); // loans adjust stock buckets
          }}
        />
      </div>

      {/* product management */}
      <div
        style={{
          display: activeTab === "productManagement" ? "block" : "none",
          height: "100%",
        }}
      >
        <ProductManagementPane
          refreshSignal={refresh.productManagement}
          onDidMutateProduct={() => {
            triggerRefresh(
              "viewStock",
              "addStock",
              "removeStock",
              "loanSummary",
              "loanHistory",
              "addLoan",
              "dashboard"
            ); // renames/types impact summary display
          }}
        />
      </div>
    </>
  );
}
