import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { invoke } from "@tauri-apps/api/core";
import { CircularProgress } from "@mui/material";

type MonthlySales = { month: string; total: number }; // month: "2025-01"

export default function SalesTrendPane({ refreshSignal }: { refreshSignal: number }) {
  const [data, setData] = useState<MonthlySales[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    invoke<MonthlySales[]>("get_monthly_sales", { months: 12 })
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [refreshSignal]);

  if (loading) {
    return <div style={{ padding: 32, textAlign: "center" }}><CircularProgress /></div>;
  }
  if (!data.length) {
    return <div style={{ padding: 32, opacity: 0.7 }}>暂无销售数据</div>;
  }

  const x = data.map(d => d.month); // e.g. "2025-01"
  const y = data.map(d => d.total);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Plot
        data={[
          {
            type: "bar",
            x,
            y,
            marker: { color: "#1976d2" },
            hovertemplate: "月份：%{x}<br>销售额：%{y}<extra></extra>",
          }
        ]}
        layout={
          {
            title: { text: "近一年每月销售额趋势" },
            xaxis: {
              title: "月份",
              type: "category",
              tickformat: "%Y-%m",
              tickangle: -45,
            },
            yaxis: {
              title: "销售额",
              rangemode: "tozero",
            },
            margin: { t: 48, r: 24, b: 56, l: 64 },
            bargap: 0.3
          } as Partial<Plotly.Layout>
        }
        config={{
          responsive: true,
          displayModeBar: false,
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
      />
    </div>
  );
}
