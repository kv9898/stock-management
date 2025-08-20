export interface DashboardData {
    /** 1) Total sellable value = (total - expired); includes expiringSoon */
    totalSellableValue?: number;
    /** 2) Value of products which soon expire */
    expiringSoonValue?: number;
    /** 3) Value of products which has expired */
    expiredValue?: number;
    /** 4) Net value of borrowed/lent products (positive = net asset, negative = net liability) */
    netLoanValue?: number;
}