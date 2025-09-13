export interface SalesHeader {
    id: string;
    date: string;
    note?: string;
}

export interface SalesItem {
    id: string;
    product_name: string;
    quantity: number;
    expiry: string;
}