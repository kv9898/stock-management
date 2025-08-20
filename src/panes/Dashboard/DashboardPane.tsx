import { RefreshCw, DollarSign, Clock8, AlertTriangle, ArrowLeftRight } from "lucide-react";
import "./DashBoard.css";

type Props = {
  /** 1) Total sellable value = (total - expired); includes expiringSoon */
  totalSellableValue?: number;
  /** 2) Value of products which soon expire */
  expiringSoonValue?: number;
  /** 3) Value of products which has expired */
  expiredValue?: number;
  /** 4) Net value of borrowed/lent products (positive = net asset, negative = net liability) */
  netLoanValue?: number;

  currency?: string;
  loading?: boolean;
  onRefresh?: () => void;
};

function formatCurrency(n: number | undefined, currency = "¥") {
  if (n === undefined || Number.isNaN(n)) return "—";
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
  // decide loan color by sign (asset vs liability)
  const loanPositive = (netLoanValue ?? 0) >= 0;

  const cards = [
    {
      key: "sellable",
      title: "可售总价值",
      value: totalSellableValue,
      icon: <DollarSign size={22} />,
      accentClass: "accent-sellable",
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
      value: expiringSoonValue,
      icon: <Clock8 size={22} />,
      accentClass: "accent-soon",
    },
    {
      key: "expired",
      title: "已过期价值",
      value: expiredValue,
      icon: <AlertTriangle size={22} />,
      accentClass: "accent-expired",
    },
    {
      key: "loan",
      title: "借/还净值",
      value: netLoanValue,
      icon: <ArrowLeftRight size={22} />,
      accentClass: loanPositive ? "accent-loan-pos" : "accent-loan-neg",
      // tiny sign hint
      subtitle: loanPositive ? "（净资产）" : "（净负债）",
    },
  ] as const;

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

      <div className="dash-grid-2x2">
        {cards.map((c) => (
          <div key={c.key} className={`dash-card ${c.accentClass}`}>
            <div className="dash-top">
              <div className="dash-pill">{c.icon}</div>
              <div className="dash-title-row">
                <div className="dash-title">{c.title}</div>
                {c.subtitle && <div className="dash-subtitle">{c.subtitle}</div>}
              </div>
            </div>

            {c.chips}

            <div className="dash-value">
              {loading ? <span className="dash-skeleton" /> : formatCurrency(c.value, currency)}
            </div>

            <div className="dash-bar" />
          </div>
        ))}
      </div>
    </div>
  );
}
