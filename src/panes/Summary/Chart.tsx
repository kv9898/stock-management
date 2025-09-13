import { useState, useEffect, useCallback } from "react";
import Plot from "react-plotly.js";
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, Button } from "@mui/material";

import { invoke } from "@tauri-apps/api/core";

export type Bucket = { expiry: string; quantity: number };

type Props = {
  data: Bucket[];
  productName?: string; // for editing stock
  onUpdated?: () => void; // ask parent to refresh after save
  loading?: boolean;
  height?: number | string; // e.g. 480 or "100%"
  showTodayLine?: boolean;
  todayColor?: string; // optional manual override
};

// System dark-mode hook (no MUI)
function usePrefersDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
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
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v || fallback;
}

export default function StockExpiryChart({
  data,
  productName,
  onUpdated,
  loading = false,
  height = "100%",
  showTodayLine = true,
  todayColor,
}: Props) {
  const [alertPeriod, setAlertPeriod] = useState<number>(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{expiry: string, quantity: number} | null>(null);
  const [newQuantity, setNewQuantity] = useState<string>("");
  const isDark = usePrefersDark();

  useEffect(() => {
    invoke<number>("get_alert_period")
      .then(setAlertPeriod)
      .catch((err) => {
        console.error("Failed to fetch alert_period:", err);
        setAlertPeriod(0);
      });
  }, []);

  // calculate colours for each bucket
  const today = new Date();
  const soonCutoff = new Date(today);
  soonCutoff.setDate(today.getDate() + alertPeriod);
  const colors = data.map((d) => {
    const expiryDate = new Date(d.expiry + "T00:00:00"); // avoid TZ drift
    if (expiryDate < today) return "#e74c3c"; // expired
    if (expiryDate < soonCutoff) return "#f1c40f"; // soon-to-expire
    return "#3498db"; // normal
  });
  
  const handleInternalBarClick = useCallback(
    async (expiry: string, quantity: number) => {
      if (!productName) return; // nothing to save against
      
      // Open the Material-UI dialog
      setEditData({ expiry, quantity });
      setNewQuantity(String(quantity));
      setEditDialogOpen(true);
    },
    [productName]
  );

  const handleEditConfirm = useCallback(async () => {
    if (!editData || !productName) return;
    
    const newQty = Number(newQuantity);
    if (!Number.isInteger(newQty) || newQty < 0) {
      alert("请输入非负整数。");
      return;
    }

    try {
      await invoke("edit_stock", {
        name: productName,
        expiryDate: editData.expiry,
        quantity: newQty,
      });
      setEditDialogOpen(false);
      setEditData(null);
      onUpdated?.(); // let parent refresh buckets & overview
    } catch (e: any) {
      console.error(e);
      alert(String(e));
    }
  }, [editData, productName, newQuantity, onUpdated]);

  const handleEditCancel = useCallback(() => {
    setEditDialogOpen(false);
    setEditData(null);
    setNewQuantity("");
  }, []);

  if (loading) return <div style={{ opacity: 0.7, padding: 12 }}>加载中…</div>;
  if (!data.length)
    return <div style={{ opacity: 0.7, padding: 12 }}>暂无该产品的库存</div>;

  const x = data.map((d) => d.expiry); // "YYYY-MM-DD"
  const y = data.map((d) => d.quantity);
  const maxY = Math.max(0, ...y);

  // UTC parse to avoid TZ shifts
  const toMsUTC = (d: string) => Date.parse(`${d}T00:00:00Z`);
  const xsMs = [...x].map(toMsUTC).sort((a, b) => a - b);

  // Bar width: 60% of min gap, or 20 days
  let barWidthMs = 20 * 24 * 3600 * 1000;
  if (xsMs.length > 1) {
    let minGap = Infinity;
    for (let i = 1; i < xsMs.length; i++)
      minGap = Math.min(minGap, xsMs[i] - xsMs[i - 1]);
    if (isFinite(minGap)) barWidthMs = Math.floor(minGap * 0.6);
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  // Theme-aware colors from your CSS vars (with sensible fallbacks)
  const textColor = cssVar("--text", isDark ? "#e6e6e6" : "#222");
  const borderColor = cssVar(
    "--border",
    isDark ? "rgba(255,255,255,.25)" : "rgba(0,0,0,.2)"
  );
  const accentColor = todayColor || cssVar("--accent", textColor);

  return (
    <div 
      style={{ width: "100%", height, pointerEvents: "auto", position: "relative" }}
    >
      <Plot
        data={[
          {
            type: "bar",
            x,
            y,
            width: barWidthMs,
            hovertemplate: "到期日：%{x}<br>数量：%{y}<extra></extra>",
            marker: {color: colors},
            hoverinfo: "x+y",
            hoverlabel: { bgcolor: "white", bordercolor: "black" }
          } as Partial<Plotly.PlotData>,
        ]}
        layout={
          {
            template: isDark ? "plotly_dark" : "plotly_white",
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { color: textColor },
            margin: { t: 8, r: 16, b: 56, l: 56 },
            bargap: 0.35,
            xaxis: {
              type: "date",
              tickformat: "%Y-%m-%d",
              hoverformat: "%Y-%m-%d",
              tickangle: -45,
              ticks: "outside",
              tickformatstops: [
                { dtickrange: [null, "M1"], value: "%Y-%m-%d" }, // day-level
                { dtickrange: ["M1", "M12"], value: "%Y-%m" }, // month-level
                { dtickrange: ["M12", null], value: "%Y" }, // year-level
              ],
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
              ? [
                  {
                    type: "line",
                    xref: "x",
                    yref: "y",
                    x0: todayISO,
                    x1: todayISO,
                    y0: 0,
                    y1: maxY * 1.08,
                    line: { width: 2, dash: "dot", color: accentColor },
                  },
                ]
              : [],
            annotations: showTodayLine
              ? [
                  {
                    x: todayISO,
                    y: maxY * 1.08,
                    xref: "x",
                    yref: "y",
                    text: "今天",
                    showarrow: false,
                    yanchor: "bottom",
                    font: { color: accentColor },
                  },
                ]
              : [],
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
          modeBarButtonsToRemove: ['toImage']
        }}
        style={{ width: "100%", height: "100%", pointerEvents: "auto" }}
        useResizeHandler
        onInitialized={(_figure: any, graphDiv: any) => {
          // Add Plotly event listeners for click interactions
          if (graphDiv) {
            graphDiv.on('plotly_click', (data: any) => {
              if (data.points && data.points.length > 0) {
                const pt = data.points[0];
                const expiry = String(pt.x);
                const qty = Number(pt.y);
                handleInternalBarClick(expiry, qty);
              }
            });
          }
        }}
        onUpdate={(_figure: any, _graphDiv: any) => {
          // Plot updated - could add logic here if needed
        }}
        onHover={(_data: any) => {
          // Optional: could add hover effects here if needed
        }}
        onClick={(_ev: any) => {
          // Using direct Plotly events instead
        }}
      />
      
      {/* Edit Stock Dialog */}
      <Dialog 
        open={editDialogOpen} 
        onClose={handleEditCancel} 
        maxWidth="sm" 
        fullWidth
        sx={{
          borderRadius: 2,
          padding: 1,
          minWidth: { xs: '90vw', sm: '400px' },
          maxWidth: { xs: '95vw', sm: '500px' },
          margin: 'auto'
        }}
      >
        <DialogTitle sx={{ pb: 1, fontSize: '1.25rem', fontWeight: 600 }}>
          编辑库存数量
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          {editData && (
            <div style={{ paddingTop: 8 }}>
              <div style={{ 
                background: 'rgba(0,0,0,0.05)', 
                padding: '16px 20px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid rgba(0,0,0,0.1)'
              }}>
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                  <strong style={{ color: '#1976d2', minWidth: '70px' }}>产品：</strong> 
                  <span style={{ marginLeft: '12px', fontSize: '1rem' }}>{productName}</span>
                </div>
                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
                  <strong style={{ color: '#1976d2', minWidth: '70px' }}>到期日：</strong> 
                  <span style={{ marginLeft: '12px', fontSize: '1rem' }}>{editData.expiry}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <strong style={{ color: '#1976d2', minWidth: '70px' }}>当前数量：</strong> 
                  <span style={{ 
                    marginLeft: '12px', 
                    fontWeight: 600, 
                    fontSize: '1.1rem',
                    color: '#2e7d32'
                  }}>{editData.quantity}</span>
                </div>
              </div>
              <TextField
                label="新数量（0 = 删除该批次）"
                type="number"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                fullWidth
                variant="outlined"
                margin="normal"
                autoFocus
                size="medium"
                inputProps={{ 
                  min: 0, 
                  step: 1,
                  style: { 
                    fontSize: '1.1rem',
                    padding: '12px 14px',
                    height: 'auto'
                  }
                }}
                sx={{
                  mt: 0,
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    minHeight: '56px'
                  },
                  '& .MuiInputBase-input': {
                    fontSize: '1.1rem',
                    lineHeight: '1.5'
                  },
                  '& .MuiInputLabel-root': {
                    fontSize: '1rem'
                  }
                }}
                helperText="输入 0 将删除此到期日的所有库存"
                FormHelperTextProps={{
                  sx: { 
                    fontSize: '0.875rem',
                    mt: 1,
                    mx: 0
                  }
                }}
              />
            </div>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1, gap: 2 }}>
          <Button 
            onClick={handleEditCancel}
            variant="outlined"
            size="large"
            sx={{ 
              borderRadius: 2,
              px: 4,
              py: 1.5,
              textTransform: 'none',
              minWidth: '100px',
              fontSize: '1rem'
            }}
          >
            取消
          </Button>
          <Button 
            onClick={handleEditConfirm} 
            variant="contained"
            size="large"
            sx={{ 
              borderRadius: 2,
              px: 4,
              py: 1.5,
              textTransform: 'none',
              boxShadow: '0 2px 8px rgba(25, 118, 210, 0.3)',
              minWidth: '120px',
              fontSize: '1rem'
            }}
          >
            确认修改
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
