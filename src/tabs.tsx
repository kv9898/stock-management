import ProductManagementPane from "./panes/ProductManagement/productManagementPane";
import AddStockPane from "./panes/Stock/AddStockPane";
import RemoveStockPane from "./panes/Stock/RemoveStockPane";
import ViewStockPane from "./panes/Summary/ViewStock";
import AddLoanPane from "./panes/Loan/AddLoanPane";
import DashboardPane from "./panes/Dashboard/DashboardPane";
import SalesHistoryPane from "./panes/Sales/SalesHistoryPane";
import LoanHistoryPane from "./panes/Loan/LoanHistoryPane";
import LoanSummaryPane from "./panes/Loan/LoanSummaryPane";

import { useState } from "react";

import { SidebarItem } from "./types/SidebarItem";

export const DEFAULT_TAB = "dashboard";

export type TabKey =
  | "boot"
  | "dashboard"
  | "viewStock"
  | "addStock"
  | "removeStock"
  | "salesHistory"
  | "loanSummary"
  | "loanHistory"
  | "addLoan"
  | "productManagement";

export const sidebarStructure: SidebarItem[] = [
  {
    key: "dashboard" as TabKey,
    label: "价值总览",
  },
  {
    key: "viewStock" as TabKey,
    label: "查看库存",
  },
  {
    key: null,
    label: "库存增减",
    children: [
      { key: "addStock" as TabKey, label: "添加库存" },
      { key: "removeStock" as TabKey, label: "移除库存" },
    ],
  },
  {
    key: null,
    label: "销售管理",
    children: [
      {key: "salesHistory" as TabKey, label: "销售记录" },
    ]
  },
  {
    key: null,
    label: "借货管理",
    children: [
      {
        key: "loanSummary" as TabKey,
        label: "借货总览",
      },
      {
        key: "loanHistory" as TabKey,
        label: "借货记录",
      },
      {
        key: "addLoan" as TabKey,
        label: "新增借货/归还",
      },
    ],
  },
  {
    key: "productManagement" as TabKey,
    label: "产品信息管理",
  },
];

export const defaultRefreshCounters = {
  viewStock: 0,
  dashboard: 0,
  addStock: 0,
  removeStock: 0,
  salesHistory: 0,
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
  setActiveTab,
}: {
  activeTab: TabKey;
  refresh: RefreshCounters;
  triggerRefresh: (...keys: (keyof typeof refresh)[]) => void;
  setActiveTab: (tab: TabKey) => void;
}) {
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* boot */}
      <div style={{ display: activeTab === "boot" ? "block" : "none", height: "100%" }}>
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
            triggerRefresh("viewStock", "dashboard","salesHistory");
          }}
        />
      </div>

      {/* sales history */}
      <div
        style={{
          display: activeTab === "salesHistory" ? "block" : "none",
          height: "100%",
        }}
      >
        <SalesHistoryPane
          refreshSignal={refresh.salesHistory}
          editingLoanId={editingLoanId}
          onDidSubmit={() => {
            triggerRefresh(
              "dashboard"
            ); // sales history may impact dashboard?
          }}
          onCloseEdit={() => setEditingLoanId(null)}
        />
      </div>

      {/* loan summary */}
      <div
        style={{
          display: activeTab === "loanSummary" ? "block" : "none",
          height: "100%",
        }}
      >
        <LoanSummaryPane
          refreshSignal={refresh.loanSummary}
          onEditLoan={(loanId) => {
            setEditingLoanId(loanId);
            setActiveTab("loanHistory"); // Switch to loan history tab
          }}
        />
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
          editingLoanId={editingLoanId}
          onDidSubmit={() => {
            triggerRefresh(
              "loanSummary",
              "dashboard"
            );
          }}
          onCloseEdit={() => setEditingLoanId(null)}
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
              "salesHistory",
              "loanSummary",
              "loanHistory",
              "addLoan",
              "dashboard"
            ); // renames/types impact summary display
          }}
        />
      </div>
    </div>
  );
}
