import * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import Plot from "react-plotly.js";

type StockSummary = { name: string; total_quantity: number };
type Bucket = { expiry: string; quantity: number };

export default function StockTab() {
  const [mode, setMode] = useState<"list" | "detail">("list");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<StockSummary[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);

  // Detail data
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Load overview once
  useEffect(() => {
    (async () => {
      const res = await invoke<StockSummary[]>("get_stock_overview");
      setRows(res);
    })().catch(err => {
      console.error(err);
      alert(String(err));
    });
  }, []);

  // When entering detail mode, load histogram
  useEffect(() => {
    if (mode !== "detail" || !selectedName) return;
    setLoadingDetail(true);
    invoke<Bucket[]>("get_stock_histogram", { name: selectedName })
      .then((res) => setBuckets(res))
      .catch((err) => {
        console.error(err);
        alert(String(err));
      })
      .finally(() => setLoadingDetail(false));
  }, [mode, selectedName]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q));
  }, [rows, search]);

  const columns: GridColDef[] = [
    { field: "name", headerName: "产品", flex: 1, minWidth: 160 },
    { field: "total_quantity", headerName: "数量", type: "number", width: 120 },
  ];

  // Shared container
  const Container: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12, height: "100%" }}>
      {children}
    </div>
  );

  if (mode === "detail" && selectedName) {
    const x = buckets.map(b => b.expiry);
    const y = buckets.map(b => b.quantity);
    const total = y.reduce((s, n) => s + (n ?? 0), 0);

    return (
      <Container>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => { setMode("list"); setSelectedName(null); }}
            style={{ padding: "6px 12px", borderRadius: 6 }}
          >
            ← 返回
          </button>
          <h2 style={{ margin: 0 }}>库存分布：{selectedName}</h2>
          <span style={{ opacity: 0.7 }}>总数量：{total}</span>
        </div>

        <div style={{ flex: 1, minHeight: 320 }}>
          {loadingDetail ? (
            <div style={{ opacity: 0.7, padding: 12 }}>加载中…</div>
          ) : buckets.length === 0 ? (
            <div style={{ opacity: 0.7, padding: 12 }}>暂无该产品的库存</div>
          ) : (
            <Plot
              data={[{
                type: "bar",
                x,
                y,
                hovertemplate: "到期日：%{x}<br>数量：%{y}<extra></extra>",
              } as Partial<Plotly.PlotData>]}
              layout={{
                margin: { t: 16, r: 16, b: 48, l: 48 },
                xaxis: { title: "到期日", type: "category", categoryorder: "array", categoryarray: x, tickangle: -45 },
                yaxis: { title: "数量", rangemode: "tozero" },
                paper_bgcolor: "rgba(0,0,0,0)",
                plot_bgcolor: "rgba(0,0,0,0)",
              } as Partial<Plotly.Layout>}
              config={{ responsive: true, displayModeBar: false }}
              style={{ width: "100%", height: "100%" }}
              useResizeHandler
              onClick={(ev: any) => {
                const pt = ev?.points?.[0];
                if (!pt) return;
                const expiry = String(pt.x);
                const qty = Number(pt.y);
                // (3) Future: open quantity editor
                alert(`未来可编辑：${selectedName}\n到期日：${expiry}\n当前数量：${qty}`);
              }}
            />
          )}
        </div>
      </Container>
    );
  }

  // List mode
  return (
    <Container>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索产品…"
          onKeyDown={(e) => e.key === "Escape" && setSearch("")}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border)" }}
        />
      </div>

      <div style={{ flex: 1 }}>
        <DataGrid
          rows={filtered.map(r => ({ id: r.name, ...r }))}
          columns={columns}
          disableColumnMenu
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          onRowClick={(p) => { setSelectedName(p.row.name); setMode("detail"); }}
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
