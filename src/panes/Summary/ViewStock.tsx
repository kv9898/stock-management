import { FC, ReactNode } from "react";
import { useEffect, useMemo, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";

import StockExpiryChart, { Bucket } from "./Chart";

type StockSummary = {
  name: string;
  total_quantity: number;
  expire_soon: number;
  expired: number;
  type?: string | null;
};

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
const UNCLASSIFIED = "__UNCLASSIFIED__";

export default function ViewStockPane({
  refreshSignal = 0,
}: {
  refreshSignal?: number;
}) {
  const [mode, setMode] = useState<"list" | "detail">("list");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<StockSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Type filtering (client-side)
  const [selectedType, setSelectedType] = useState<string>(ALL);

  // Detail data
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ---- fetchers -------------------------------------------------------------

  const fetchOverview = useCallback(async () => {
    const data = await invoke<StockSummary[]>("get_stock_overview");
    setRows(data);
  }, []);

  const fetchHistogram = useCallback(async (name: string) => {
    setLoadingDetail(true);
    try {
      const data = await invoke<Bucket[]>("get_stock_histogram", { name });
      setBuckets(data);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // initial load
  useEffect(() => {
    fetchOverview().catch((err) => {
      console.error(err);
      alert(String(err));
    });
  }, [fetchOverview]);

  // refresh on signal; also keep detail view in sync if it’s open
  useEffect(() => {
    (async () => {
      try {
        await fetchOverview();
        if (mode === "detail" && selectedName) {
          await fetchHistogram(selectedName);
        }
      } catch (err) {
        console.error(err);
        alert(String(err));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]); // only when parent bumps the counter

  // when entering detail mode or changing selection, (re)load histogram
  useEffect(() => {
    if (mode !== "detail" || !selectedName) return;
    fetchHistogram(selectedName).catch((err) => {
      console.error(err);
      alert(String(err));
    });
  }, [mode, selectedName, fetchHistogram]);

  // --------------------------------------------------------------------------

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

  const columns: GridColDef[] = useMemo(
    () => [
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
        width: 80,
        valueGetter: (_value, row) => row.type ?? "未分类",
        sortComparator: (a, b) =>
          (a ?? "未分类").localeCompare(b ?? "未分类", undefined, {
            sensitivity: "base",
            numeric: true,
          }),
      },
      { field: "expired", headerName: "过期", type: "number", width: 80 },
      { field: "expire_soon", headerName: "近期", type: "number", width: 90 },
      {
        field: "total_quantity",
        headerName: "总数",
        type: "number",
        width: 100,
      },
    ],
    []
  );

  const rowsForGrid = useMemo(
    () =>
      [...filtered]
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
        .map((r) => ({ id: r.name, ...r })),
    [filtered]
  );
  return (
    <Container>
      {/* LIST VIEW (kept mounted) */}
      <div
        style={{
          display: mode === "list" ? "block" : "none",
          height: "100%",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
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

        <div style={{ flex: 1, minHeight: 0, height: "100%" }}>
          <DataGrid
            rows={rowsForGrid}
            columns={columns}
            getRowId={(r) => r.id}
            disableColumnMenu
            autoPageSize
            onRowClick={(p) => {
              setSelectedName(p.row.name);
              setMode("detail");
            }}
            sx={{
              height: "100%",
              borderRadius: 1,
              bgcolor: "background.default",
              "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover" },
            }}
          />
        </div>
      </div>

      {/* DETAIL VIEW (kept mounted) */}
      <div
        style={{
          display: mode === "detail" ? "block" : "none",
          height: "100%",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => {
              setMode("list"); // just toggles display; list stays mounted
              setSelectedName(null); // optional: keep selection or clear it
            }}
            style={{ padding: "6px 12px", borderRadius: 6 }}
          >
            ← 返回
          </button>
          <h2 style={{ margin: 0 }}>库存分布：{selectedName}</h2>
          <span style={{ opacity: 0.7 }}>
            总数量：{buckets.reduce((s, b) => s + (b.quantity ?? 0), 0)}
          </span>
        </div>

        <div style={{ flex: 1, minHeight: 0, height: "100%" }}>
          <StockExpiryChart
            data={buckets}
            productName={selectedName ?? undefined}
            loading={loadingDetail}
            height="100%"
            onUpdated={async () => {
              // this is a *real* data change -> refresh both detail + list
              const [newBuckets, newOverview] = await Promise.all([
                selectedName
                  ? invoke<Bucket[]>("get_stock_histogram", {
                      name: selectedName,
                    })
                  : Promise.resolve(buckets),
                invoke<StockSummary[]>("get_stock_overview"),
              ]);
              setBuckets(newBuckets);
              setRows(newOverview);
            }}
          />
        </div>
      </div>
    </Container>
  );
}
