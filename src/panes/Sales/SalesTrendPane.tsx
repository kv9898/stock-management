import { useEffect, useState } from "react";
import Plot from "react-plotly.js";
import { invoke } from "@tauri-apps/api/core";
import { CircularProgress } from "@mui/material";

type MonthlySales = { month: string; total: number }; // month: "2025-01"

// Extend window type for Plotly
declare global {
  interface Window {
    Plotly: any;
  }
}

// System dark-mode hook (no MUI)
function usePrefersDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    // Safari support
    mq.addEventListener("change", update);
    return () => {
      mq.removeEventListener("change", update);
    };
  }, []);
  return dark;
}

// Read a CSS variable with fallback
function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export default function SalesTrendPane({ refreshSignal }: { refreshSignal: number }) {
  const [data, setData] = useState<MonthlySales[]>([]);
  const [loading, setLoading] = useState(true);
  const [plotKey, setPlotKey] = useState(0);
  const isDark = usePrefersDark();

  useEffect(() => {
    if (refreshSignal === 0) return; // Skip initial
    setLoading(true);
    invoke<MonthlySales[]>("get_monthly_sales", { months: 12 })
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [refreshSignal]);

  // Force plot re-render when data changes to ensure proper sizing
  useEffect(() => {
    if (!loading && data.length > 0) {
      const timer = setTimeout(() => {
        setPlotKey(prev => prev + 1);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, data.length]);

  if (loading) {
    return <div style={{ padding: 32, textAlign: "center" }}><CircularProgress /></div>;
  }
  if (!data.length) {
    return <div style={{ padding: 32, opacity: 0.7 }}>暂无销售数据</div>;
  }

  const x = data.map(d => d.month); // e.g. "2025-01"
  const y = data.map(d => d.total);

  // Theme-aware colors from your CSS vars (with sensible fallbacks)
  const textColor = cssVar("--text", isDark ? "#e6e6e6" : "#222");
  const borderColor = cssVar(
    "--border",
    isDark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.2)"
  );
  const barColor = cssVar("--accent", "#1976d2");

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "400px" }}>
      <Plot
        key={plotKey}
        data={[
          {
            type: "bar",
            x,
            y,
            marker: { color: barColor },
            hovertemplate: "月份：%{x}<br>销售额：%{y}<extra></extra>",
          }
        ]}
        layout={
          {
            template: isDark ? "plotly_dark" : "plotly_white",
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: textColor },
            title: { 
              text: "近一年每月销售额趋势",
              font: { color: textColor }
            },
            xaxis: {
              title: "月份",
              type: "category",
              tickformat: "%Y-%m",
              tickangle: -45,
              showgrid: true,
              gridcolor: borderColor,
              linecolor: borderColor,
              zerolinecolor: borderColor,
              ticks: "outside",
              tickfont: { color: textColor },
              titlefont: { color: textColor },
              automargin: true,
            },
            yaxis: {
              title: "销售额",
              rangemode: "tozero",
              showgrid: true,
              gridcolor: borderColor,
              linecolor: borderColor,
              zerolinecolor: borderColor,
              tickfont: { color: textColor },
              titlefont: { color: textColor },
              automargin: true,
            },
            margin: { t: 64, r: 32, b: 80, l: 80 },
            bargap: 0.3,
            autosize: true,
          } as Partial<Plotly.Layout>
        }
        config={{
          responsive: true,
          displayModeBar: false,
          staticPlot: false,
          editable: false,
          scrollZoom: false,
          doubleClick: false,
          showTips: false,
          displaylogo: false,
        }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        onInitialized={(_figure: any, graphDiv: any) => {
          // Force resize after initialization
          if (graphDiv && window.Plotly) {
            setTimeout(() => {
              window.Plotly.Plots.resize(graphDiv);
            }, 50);
          }
        }}
        onUpdate={(_figure: any, graphDiv: any) => {
          // Ensure proper sizing on updates
          if (graphDiv && window.Plotly) {
            window.Plotly.Plots.resize(graphDiv);
          }
        }}
      />
    </div>
  );
}
