import { RefreshCw, DollarSign, Clock8, AlertTriangle, ArrowLeftRight } from "lucide-react";

import "./DashBoard.css"

type Props = {
  /** 1) Total sellable value = total - expired */
  totalSellableValue?: number;
  /** 2) Value of products which soon expire */
  expiringSoonValue?: number;
  /** 3) Value of products which has expired */
  expiredValue?: number;
  /** 4) Net value of borrowed/lent products (positive = net asset, negative = net liability) */
  netLoanValue?: number;

  /** Currency symbol for display (default: ¥) */
  currency?: string;

  /** Show shimmer placeholders instead of numbers */
  loading?: boolean;

  /** Optional refresh handler (adds a button) */
  onRefresh?: () => void;
};

function formatCurrency(n: number | undefined, currency = "¥") {
  if (n === undefined || Number.isNaN(n)) return "—";
  // thousands group, 2 decimals; tweak as needed
  const s = new Intl.NumberFormat("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return `${currency}${s}`;
}

export default function DashboardPane({
  totalSellableValue,
  expiringSoonValue,
  expiredValue,
  netLoanValue,
  currency = "¥",
  loading = false,
  onRefresh,
}: Props) {
  const cards = [
    {
      title: "可售总价值",
      value: totalSellableValue,
      icon: <DollarSign size={22} />,
      accent: "var(--dash-accent-1)",
    },
    {
      title: "即将过期价值",
      value: expiringSoonValue,
      icon: <Clock8 size={22} />,
      accent: "var(--dash-accent-2)",
    },
    {
      title: "已过期价值",
      value: expiredValue,
      icon: <AlertTriangle size={22} />,
      accent: "var(--dash-accent-3)",
    },
    {
      title: "借/还净值",
      value: netLoanValue,
      icon: <ArrowLeftRight size={22} />,
      accent: "var(--dash-accent-4)",
    },
  ];

  return (
    <div className="dash-wrap">
      <div className="dash-header">
        <h2>仪表盘</h2>
        {onRefresh && (
          <button className="dash-refresh" onClick={onRefresh}>
            <RefreshCw size={16} />
            <span>刷新</span>
          </button>
        )}
      </div>

      <div className="dash-grid">
        {cards.map((c) => (
          <div key={c.title} className="dash-card" style={{ background: c.bg }}>
            <div className="dash-top">
              <div className="dash-pill" style={{ backgroundColor: c.accent }}>
                {c.icon}
              </div>
              <div className="dash-title">{c.title}</div>
            </div>

            <div className="dash-value">
              {loading ? <span className="dash-skeleton" /> : formatCurrency(c.value, currency)}
            </div>

            {/* tiny baseline bar purely decorative */}
            <div className="dash-bar" style={{ background: c.accent }} />
          </div>
        ))}
      </div>
    </div>
  );
}
