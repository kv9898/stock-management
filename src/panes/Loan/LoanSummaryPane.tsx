// src/panes/Loan/LoanSummaryPane.tsx
import { FC, ReactNode } from "react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { filter } from "fuzzaldrin-plus";
import TransactionDetailsModal from "./TransactionDetails";

type LoanSummary = {
  counterparty: string;
  productName: string;
  productType: string | null;
  netQuantity: number;
  direction: string;
};

interface LoanSummaryPaneProps {
  refreshSignal?: number;
  onEditLoan?: (loanId: string) => void; // Add this line
}

const Container: FC<{ children: ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      height: "100%",
      minHeight: 0,
    }}
  >
    {children}
  </div>
);

const ALL = "__ALL__";

export default function LoanSummaryPane({
  refreshSignal = 0,
  onEditLoan, // Add this line
}: LoanSummaryPaneProps) {
  const [rows, setRows] = useState<LoanSummary[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCounterparty, setSelectedCounterparty] = useState<string>(ALL);
  const [loading, setLoading] = useState(false);

  const [selectedTransaction, setSelectedTransaction] = useState<{
    counterparty: string;
    productName: string;
  } | null>(null);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);

  const fetchLoanSummary = useCallback(async () => {
    setLoading(true);
    try {
      const data = await invoke<LoanSummary[]>("get_loan_summary");
      setRows(data);
    } catch (err) {
      console.error("Error fetching loan summary:", err);
      alert("加载借货总览失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLoanSummary();
  }, [fetchLoanSummary]);

  useEffect(() => {
    if (refreshSignal > 0) {
      fetchLoanSummary();
    }
  }, [refreshSignal, fetchLoanSummary]);

  // Distinct counterparties from data
  const counterpartyOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.counterparty) set.add(r.counterparty);
    }
    return [ALL, ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  // Filter locally: first by counterparty, then by fuzzy search
  const filtered = useMemo(() => {
    let list = rows;

    // Filter by counterparty
    if (selectedCounterparty !== ALL) {
      list = list.filter((r) => r.counterparty === selectedCounterparty);
    }

    // Fuzzy search on product name and type
    const q = search.trim();
    if (q) {
      const enriched = list.map((r) => ({
        loan: r,
        key: `${r.productName} ${r.productType ?? ""} ${r.counterparty}`,
      }));
      list = filter(enriched, q, { key: "key" }).map((m) => m.loan);
    }

    return list;
  }, [rows, search, selectedCounterparty]);

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "counterparty",
        headerName: "对方姓名",
        flex: 1,
        minWidth: 120,
        sortComparator: (a, b) =>
          String(a ?? "").localeCompare(String(b ?? ""), undefined, {
            sensitivity: "base",
            numeric: true,
          }),
      },
      {
        field: "productName",
        headerName: "产品",
        flex: 1,
        minWidth: 160,
        sortComparator: (a, b) =>
          String(a ?? "").localeCompare(String(b ?? ""), undefined, {
            sensitivity: "base",
            numeric: true,
          }),
      },
      {
        field: "productType",
        headerName: "类型",
        width: 100,
        valueGetter: (_value, row) => row.productType ?? "未分类",
        sortComparator: (a, b) =>
          (a ?? "未分类").localeCompare(b ?? "未分类", undefined, {
            sensitivity: "base",
            numeric: true,
          }),
      },
      {
        field: "netQuantity",
        headerName: "净数量",
        type: "number",
        width: 100,
        valueGetter: (v) => v ?? 0,
      },
      {
        field: "direction",
        headerName: "状态",
        width: 80,
        renderCell: (params) => {
          const value = params.row.netQuantity ?? 0;
          if (value > 0) return <span style={{ color: "#d32f2f" }}>借出</span>; // We owe them
          if (value < 0) return <span style={{ color: "#2e7d32" }}>借入</span>; // They owe us
          return "平衡";
        },
      },
    ],
    []
  );

  const rowsForGrid = useMemo(
    () =>
      [...filtered].map((r, index) => ({
        id: `${r.counterparty}-${r.productName}-${r.productType}-${index}`,
        ...r,
      })),
    [filtered]
  );

  return (
    <Container>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <FormControl size="small" style={{ minWidth: 160 }}>
          <InputLabel id="counterparty-filter-label">对方单位</InputLabel>
          <Select
            labelId="counterparty-filter-label"
            label="对方单位"
            value={selectedCounterparty}
            onChange={(e) => setSelectedCounterparty(String(e.target.value))}
          >
            {counterpartyOptions.map((t) =>
              t === ALL ? (
                <MenuItem key={t} value={t}>
                  (全部)
                </MenuItem>
              ) : (
                <MenuItem key={t} value={t}>
                  {t}
                </MenuItem>
              )
            )}
          </Select>
        </FormControl>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索产品、类型或对方单位…"
          onKeyDown={(e) => e.key === "Escape" && setSearch("")}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        />
      </div>

      <div style={{ flex: 1, minHeight: 0, height: "100%" }}>
        <DataGrid
          rows={rowsForGrid}
          columns={columns}
          loading={loading}
          disableColumnMenu
          autoPageSize
          onRowClick={(params) => {
            setSelectedTransaction({
              counterparty: params.row.counterparty,
              productName: params.row.productName,
            });
          }}
          sx={{
            height: "100%",
            borderRadius: 1,
            bgcolor: "background.default",
            "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
          }}
          slots={{
            noRowsOverlay: () => (
              <div style={{ padding: 16, opacity: 0.6 }}>
                {loading ? "加载中…" : "没有匹配的借货记录"}
              </div>
            ),
          }}
        />
      </div>
      <TransactionDetailsModal
        open={!!selectedTransaction}
        counterparty={selectedTransaction?.counterparty || ""}
        productName={selectedTransaction?.productName || ""}
        onClose={() => setSelectedTransaction(null)}
        onEditTransaction={(loanId) => {
          setEditingLoanId(loanId);
          onEditLoan?.(loanId); // Pass the loanId to parent
          setSelectedTransaction(null); // Close the modal
        }}
      />
    </Container>
  );
}
