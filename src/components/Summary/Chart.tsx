import * as React from "react";
import Plot from "react-plotly.js";

export type Bucket = { expiry: string; quantity: number };

type Props = {
  data: Bucket[];
  loading?: boolean;
  height?: number | string;              // e.g. 480 or "100%"
  showTodayLine?: boolean;
  todayColor?: string;                   // optional manual override
  onBarClick?: (args: { expiry: string; quantity: number }) => void;
};

// System dark-mode hook (no MUI)
function usePrefersDark() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setDark(mq.matches);
    update();
    // Safari support
    mq.addEventListener?.("change", update);
    mq.addListener?.(update as any);
    return () => {
      mq.removeEventListener?.("change", update);
      mq.removeListener?.(update as any);
    };
  }, []);
  return dark;
}

// Read a CSS variable with fallback
function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export default function StockExpiryChart({
  data,
  loading = false,
  height = "100%",
  showTodayLine = true,
  todayColor,
  onBarClick,
}: Props) {
  const isDark = usePrefersDark();

  if (loading) return <div style={{ opacity: 0.7, padding: 12 }}>加载中…</div>;
  if (!data.length) return <div style={{ opacity: 0.7, padding: 12 }}>暂无该产品的库存</div>;

  const x = data.map(d => d.expiry);        // "YYYY-MM-DD"
  const y = data.map(d => d.quantity);
  const maxY = Math.max(0, ...y);

  // UTC parse to avoid TZ shifts
  const toMsUTC = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const xsMs = [...x].map(toMsUTC).sort((a, b) => a - b);

  // Bar width: 60% of min gap, or 20 days
  let barWidthMs = 20 * 24 * 3600 * 1000;
  if (xsMs.length > 1) {
    let minGap = Infinity;
    for (let i = 1; i < xsMs.length; i++) minGap = Math.min(minGap, xsMs[i] - xsMs[i - 1]);
    if (isFinite(minGap)) barWidthMs = Math.floor(minGap * 0.6);
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  // Theme-aware colors from your CSS vars (with sensible fallbacks)
  const textColor   = cssVar("--text",   isDark ? "#e6e6e6" : "#222");
  const borderColor = cssVar("--border", isDark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.2)");
  const accentColor = todayColor || cssVar("--accent", textColor);

  return (
    <div style={{ width: "100%", height }}>
      <Plot
        data={[
          {
            type: "bar",
            x,
            y,
            width: barWidthMs,
            hovertemplate: "到期日：%{x}<br>数量：%{y}<extra></extra>",
          } as Partial<Plotly.PlotData>,
        ]}
        layout={{
          template: isDark ? "plotly_dark" : "plotly_white",
          paper_bgcolor: "rgba(0,0,0,0)",
          plot_bgcolor: "rgba(0,0,0,0)",
          font: { color: textColor },
          margin: { t: 8, r: 16, b: 56, l: 56 },
          bargap: 0.35,
          xaxis: {
            type: "date",
            tickformat: "%Y-%m-%d",
            tickangle: -45,
            ticks: "outside",
            showgrid: true,
            gridcolor: borderColor,
            linecolor: borderColor,
            zerolinecolor: borderColor,
          },
          yaxis: {
            title: "数量",
            rangemode: "tozero",
            gridcolor: borderColor,
            linecolor: borderColor,
            zerolinecolor: borderColor,
          },
          shapes: showTodayLine
            ? [{
                type: "line",
                xref: "x", yref: "y",
                x0: todayISO, x1: todayISO, y0: 0, y1: maxY * 1.08,
                line: { width: 2, dash: "dot", color: accentColor },
              }]
            : [],
          annotations: showTodayLine
            ? [{
                x: todayISO, y: maxY * 1.08, xref: "x", yref: "y",
                text: "今天", showarrow: false, yanchor: "bottom",
                font: { color: accentColor },
              }]
            : [],
        } as Partial<Plotly.Layout>}
        config={{ responsive: true, displayModeBar: false }}
        style={{ width: "100%", height: "100%" }}
        useResizeHandler
        onClick={(ev: any) => {
          const pt = ev?.points?.[0];
          if (!pt) return;
          onBarClick?.({ expiry: String(pt.x), quantity: Number(pt.y) });
        }}
      />
    </div>
  );
}
