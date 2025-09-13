import { TabKey } from "../tabs";

export type SidebarItem = {
    key: TabKey | null;         // null = group/header (not clickable)
    label: string;              // display label
    children?: SidebarItem[];   // optional nested items
};