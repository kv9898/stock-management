import {
  RefreshCw,
  DollarSign,
  Clock8,
  AlertTriangle,
  ArrowLeftRight,
} from "lucide-react";
import "./DashBoard.css";
import type { Card } from "../../types/Card";
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DashboardData } from "../../types/dashboard";

type Props = {
  currency?: string;
  onRefresh?: () => void;
  refreshSignal?: number; // to trigger re-render when parent changes this
};

function formatCurrency(n: number | undefined, currency = "¥") {
  if (n === undefined || Number.isNaN(n)) return "—";
  const s = new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${currency}${s}`;
}

export default function DashboardPane({
  currency = "¥",
  onRefresh,
  refreshSignal,
}: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<DashboardData>("get_dashboard_summary");
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch dashboard data");
      console.error("Error fetching dashboard:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshSignal]);

  const handleRefresh = () => {
    fetchDashboardData();
    onRefresh?.();
  };

  // decide loan color by sign (asset vs liability)
  const loanPositive = (data?.netLoanValue ?? 0) >= 0;

  if (error) {
    return (
      <div className="dash-wrap">
        <div className="dash-header">
          <h2>价值总览</h2>
          <button className="dash-refresh" onClick={handleRefresh}>
            <RefreshCw size={16} />
            <span>重试</span>
          </button>
        </div>
        <div style={{ padding: "2rem", textAlign: "center", color: "#666" }}>
          <p>加载失败: {error}</p>
        </div>
      </div>
    );
  }

  const cards: Card[] = [
    {
      key: "sellable",
      title: "可售总价值",
      value: data?.totalSellableValue,
      icon: <DollarSign size={50} strokeWidth={2.4} />,
      accentClass: "accent-sellable",
      valueClass: "value-sellable",
      // show the relationship chips just for this card
      chips: (
        <div className="chips">
          <span className="chip chip-plus">包含 即将过期</span>
          <span className="chip chip-minus">不含 已过期 / 借还</span>
        </div>
      ),
    },
    {
      key: "soon",
      title: "即将过期价值",
      value: data?.expiringSoonValue,
      icon: <Clock8 size={50} strokeWidth={2.4} />,
      accentClass: "accent-soon",
      valueClass: "value-soon",
    },
    {
      key: "expired",
      title: "已过期价值",
      value: data?.expiredValue,
      icon: <AlertTriangle size={50} strokeWidth={2.4} />,
      accentClass: "accent-expired",
      valueClass: "value-expired",
    },
    {
      key: "loan",
      title: "借/还净值",
      value: data?.netLoanValue,
      icon: <ArrowLeftRight size={50} strokeWidth={2.4} />,
      accentClass: loanPositive ? "accent-loan-pos" : "accent-loan-neg",
      valueClass: loanPositive ? "value-loan-pos" : "value-loan-neg",
      // tiny sign hint
      subtitle: loanPositive ? "（净资产）" : "（净负债）",
    },
  ] as const;

  return (
    <div className="dash-wrap">
      <div className="dash-header">
        <h2>价值总览</h2>
        <button className="dash-refresh" onClick={handleRefresh}>
          <RefreshCw size={16} />
          <span>刷新</span>
        </button>
      </div>

      <div className="dash-grid-2x2">
        {cards.map((c) => (
          <div key={c.key} className={`dash-card ${c.accentClass}`}>
            {/* LEFT ICON + PATTERN */}
            <div className="dash-icon-left">
              {/* SVG icon uses currentColor -> we tint via --accent */}
              <div className="dash-icon">{c.icon}</div>
            </div>

            {/* RIGHT CONTENT */}
            <div className="dash-right">
              <div className="dash-top">
                <div className="dash-title-row">
                  <div className="dash-title">{c.title}</div>
                  {"subtitle" in c && c.subtitle ? (
                    <div className="dash-subtitle">{c.subtitle}</div>
                  ) : null}
                </div>
              </div>

              {"chips" in c && c.chips}

              <div className={`dash-value ${c.valueClass}`}>
                {loading ? (
                  <span className="dash-skeleton" />
                ) : (
                  formatCurrency(c.value, currency)
                )}
              </div>
            </div>

            {/* decorative bottom bar (kept) */}
            <div className="dash-bar" />
          </div>
        ))}
      </div>
    </div>
  );
}
