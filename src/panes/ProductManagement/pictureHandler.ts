/** If it's a data URL like "data:image/png;base64,AAA...", strip the prefix; otherwise return as-is. */
export const stripDataUrl = (s: string | null | undefined): string | null => {
    if (!s) return null;
    const comma = s.indexOf(",");
    if (comma !== -1 && s.slice(0, comma).toLowerCase().includes(";base64")) {
        return s.slice(comma + 1);
    }
    return s;
};

/** Turn raw base64 (or a data URL) into a data URL for <img src>. */
export const toDataUrl = (b64OrDataUrl: string | null | undefined, mime = "image/png"): string | null => {
    if (!b64OrDataUrl) return null;
    if (b64OrDataUrl.startsWith("data:")) return b64OrDataUrl;
    return `data:${mime};base64,${b64OrDataUrl}`;
};