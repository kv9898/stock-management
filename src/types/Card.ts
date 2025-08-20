import { ReactNode } from "react";

export type Card = {
    key: string;
    title: string;
    value: number | undefined;
    icon: ReactNode;
    accentClass: string;
    valueClass: string;
    chips?: ReactNode;
    subtitle?: string;
}