// theme.ts
import { extendTheme } from '@mui/material/styles';
import { zhCN as coreZhCN } from '@mui/material/locale';
import { zhCN as gridZhCN } from '@mui/x-data-grid/locales';


export const theme = extendTheme(
    {
        colorSchemes: {
            light: { palette: {} },
            dark: { palette: {} },
        },
    },
    coreZhCN,  // ← pass as extra args
    gridZhCN   // ← pass as extra args
);