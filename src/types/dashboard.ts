export interface DashboardValueData {
    /** 1) Total sellable value = (total - expired); includes expiringSoon */
    totalSellableValue?: number;
    /** 2) Value of products which soon expire */
    expiringSoonValue?: number;
    /** 3) Value of products which has expired */
    expiredValue?: number;
    /** 4) Net value of borrowed/lent products (positive = net asset, negative = net liability) */
    netLoanValue?: number;
}

export interface DashboardSalesData {
    /** 1) Total monetary value sold for the month */
    this_month_total: number;
    /** 2) Total monetary value sold for the same period last month */
    last_month_same_period_total: number
}