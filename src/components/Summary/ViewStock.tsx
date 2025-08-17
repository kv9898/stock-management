import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

import StockExpiryChart, { Bucket } from "./Chart";

type StockSummary = {
  name: string;
  total_quantity: number;
  type?: string | null;
};

const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      height: "100%",
    }}
  >
    {children}
  </div>
);

const ALL = "__ALL__";
const UNCLASSIFIED = "__UNCLASSIFIED__";

export default function ViewStockTab() {
  const [mode, setMode] = useState<"list" | "detail">("list");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<StockSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Type filtering (client-side)
  const [selectedType, setSelectedType] = useState<string>(ALL);

  // Detail data
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Fetch everything once
  useEffect(() => {
    invoke<StockSummary[]>("get_stock_overview")
      .then(setRows)
      .catch((err) => {
        console.error(err);
        alert(String(err));
      });
  }, []);

  // Distinct types from data
  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      if (r.type == null) set.add(UNCLASSIFIED);
      else set.add(r.type);
    }
    return [
      ALL,
      ...Array.from(set).sort((a, b) => {
        if (a === UNCLASSIFIED) return 1;
        if (b === UNCLASSIFIED) return -1;
        return a.localeCompare(b, undefined, {
          sensitivity: "base",
          numeric: true,
        });
      }),
    ];
  }, [rows]);

  // Filter locally: first by type, then by search
  const filtered = useMemo(() => {
    let list = rows;
    if (selectedType !== ALL) {
      list = list.filter((r) =>
        selectedType === UNCLASSIFIED ? !r.type : r.type === selectedType
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    return list;
  }, [rows, search, selectedType]);

  // Load histogram on detail
  useEffect(() => {
    if (mode !== "detail" || !selectedName) return;
    setLoadingDetail(true);
    invoke<Bucket[]>("get_stock_histogram", { name: selectedName })
      .then(setBuckets)
      .catch((err) => {
        console.error(err);
        alert(String(err));
      })
      .finally(() => setLoadingDetail(false));
  }, [mode, selectedName]);

  const rowsForGrid = [...filtered] // pre-sorted
    .sort((a, b) => {
      const t1 = a.type ?? "未分类";
      const t2 = b.type ?? "未分类";
      const byType = t1.localeCompare(t2, undefined, {
        sensitivity: "base",
        numeric: true,
      });
      if (byType) return byType;
      return a.name.localeCompare(b.name, undefined, {
        sensitivity: "base",
        numeric: true,
      });
    })
    .map((r) => ({ id: r.name, ...r }));

  const columns: GridColDef[] = [
    {
      field: "name",
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
      field: "type",
      headerName: "类型",
      width: 140,
      valueGetter: (_value, row) => row.type ?? "未分类",
      sortComparator: (a, b) =>
        (a ?? "未分类").localeCompare(b ?? "未分类", undefined, {
          sensitivity: "base",
          numeric: true,
        }),
    },
    { field: "total_quantity", headerName: "数量", type: "number", width: 120 },
  ];

  if (mode === "detail" && selectedName) {
    const y = buckets.map((b) => b.quantity);
    const total = y.reduce((s, n) => s + (n ?? 0), 0);

    return (
      <Container>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => {
              setMode("list");
              setSelectedName(null);
            }}
            style={{ padding: "6px 12px", borderRadius: 6 }}
          >
            ← 返回
          </button>
          <h2 style={{ margin: 0 }}>库存分布：{selectedName}</h2>
          <span style={{ opacity: 0.7 }}>总数量：{total}</span>
        </div>

        <div style={{ flex: 1, minHeight: 320 }}>
          <StockExpiryChart
            data={buckets}
            productName={selectedName!}
            loading={loadingDetail}
            height="100%" // fill parent area
            onUpdated={async () => {
              const [newBuckets, newOverview] = await Promise.all([
                invoke<Bucket[]>("get_stock_histogram", { name: selectedName }),
                invoke<StockSummary[]>("get_stock_overview"),
              ]);
              setBuckets(newBuckets);
              setRows(newOverview);
            }}
          />
        </div>
      </Container>
    );
  }

  // List mode
  return (
    <Container>
      <div style={{ display: "flex", gap: 8 }}>
        <FormControl size="small" style={{ minWidth: 160 }}>
          <InputLabel id="type-filter-label">类型</InputLabel>
          <Select
            labelId="type-filter-label"
            label="类型"
            value={selectedType}
            onChange={(e) => setSelectedType(String(e.target.value))}
          >
            {typeOptions.map((t) =>
              t === ALL ? (
                <MenuItem key={t} value={t}>
                  (全部)
                </MenuItem>
              ) : t === UNCLASSIFIED ? (
                <MenuItem key={t} value={t}>
                  (未分类)
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
          placeholder="搜索产品…"
          onKeyDown={(e) => e.key === "Escape" && setSearch("")}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 6,
            border: "1px solid var(--border)",
          }}
        />
      </div>

      <div style={{ flex: 1 }}>
        <DataGrid
          rows={rowsForGrid}
          columns={columns}
          disableColumnMenu
          autoPageSize
          // pageSizeOptions={[10, 25, 50]}
          paginationModel={{ page: 0, pageSize: 25 }}
          onRowClick={(p) => {
            setSelectedName(p.row.name);
            setMode("detail");
          }}
          sx={{
            borderRadius: 1,
            bgcolor: "background.default",
            "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
          }}
        />
      </div>
    </Container>
  );
}
