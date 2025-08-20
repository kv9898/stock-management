export type Direction = "loan_in" | "loan_out" | "return_in" | "return_out";

export interface LoanHeader {
    id: string;
    date: string;
    direction: Direction;
    counterparty: string;
    note: string | null;
}

export interface LoanItem {
    id: string;
    product_name: string;
    quantity: number;
    expiry?: string; // Optional because it's only required when adjustStock is true
}