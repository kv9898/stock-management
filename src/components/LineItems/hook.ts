import { useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export type LineItem = {
    id: string;
    product: string;        // product name
    qty: number | null;
    expiry: string | null;  // YYYY-MM-DD or null
};

export function makeEmptyItem(): LineItem {
    return { id: uuidv4(), product: "", qty: null, expiry: null };
}

export const isItemEmpty = (r: LineItem) => !r.product && r.qty == null && !r.expiry;
export const isItemComplete = (r: LineItem) => !!r.product && r.qty != null && !!r.expiry;

// safe numeric parser: "" -> null, valid -> number
export function parseNum(s: string): number | null {
    if (s.trim() === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
}

export function useLineItems(initial?: LineItem[]) {
    const [rows, setRows] = useState<LineItem[]>(initial?.length ? initial : [makeEmptyItem()]);
    const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

    const ensureTrailingBlank = (list: LineItem[]) => {
        if (list.length === 0) return [makeEmptyItem()];
        const last = list[list.length - 1];
        return isItemEmpty(last) ? list : [...list, makeEmptyItem()];
    };

    const setRow = (id: string, updater: (r: LineItem) => LineItem) => {
        setRows((rs) => ensureTrailingBlank(rs.map((r) => (r.id === id ? updater({ ...r }) : r))));
    };

    const removeRow = (id: string) => {
        setRows((rs) => {
            const after = rs.filter((r) => r.id !== id);
            return ensureTrailingBlank(after.length === 0 ? [makeEmptyItem()] : after);
        });
    };

    // ghost helpers
    const isGhost = (r: LineItem, idx: number) => idx === rows.length - 1 && isItemEmpty(r);
    const nonGhostRows = useMemo(
        () => rows.filter((r, idx) => !isGhost(r, idx)),
        [rows]
    );

    // keyboard nav
    function focusNext(rowIdx: number, colIdx: number) {
        const nextCol = colIdx + 1;
        if (inputRefs.current[rowIdx]?.[nextCol]) {
            inputRefs.current[rowIdx][nextCol]?.focus();
        } else {
            const nextRow = rowIdx + 1;
            if (inputRefs.current[nextRow]?.[0]) inputRefs.current[nextRow][0]?.focus();
        }
    }

    function handleEnter(
        e: React.KeyboardEvent<HTMLInputElement> | null,
        rowIdx: number,
        colIdx: number
    ) {
        if (e) {
            if (e.key !== "Enter") return;
            e.preventDefault();
        }
        focusNext(rowIdx, colIdx);
    }

    const api = {
        rows,
        setRow,
        removeRow,
        reset: () => setRows([makeEmptyItem()]),
        inputRefs,
        nonGhostRows,
        isGhost,
        handleEnter,
    };
    return api;
}
