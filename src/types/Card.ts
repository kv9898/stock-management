export type Card = {
    key: string;
    title: string;
    value: number | undefined;
    icon: JSX.Element;
    accentClass: string;
    valueClass: string;
    chips?: JSX.Element;
    subtitle?: string;
}