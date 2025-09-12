// ResponsiveLayout.tsx
import {
  Drawer,
  List,
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  useMediaQuery,
  ListItemButton,
  ListItemText,
  Box,
} from "@mui/material";
import { Menu as MenuIcon, Settings } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useState, PropsWithChildren } from "react";
import type { TabKey } from "../../tabs";
import { sidebarStructure } from "../../tabs";
import { SidebarList } from "./SidebarList";

export const DRAWER_WIDTH = 180;

type ResponsiveLayoutProps = {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  onOpenSettings?: () => void;
};

export default function ResponsiveLayout({
  activeTab,
  setActiveTab,
  onOpenSettings,
  children,
}: PropsWithChildren<ResponsiveLayoutProps>) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [drawerOpen, setDrawerOpen] = useState(false);

  const drawerContent = (
    <List sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <SidebarList
        items={sidebarStructure}
        activeTab={activeTab}
        onSelect={(key) => setActiveTab(key)}
      />
      {/* Settings pinned at bottom */}
      <div style={{ marginTop: "auto", padding: "1rem" }}>
        <ListItemButton onClick={onOpenSettings}>
          <Settings sx={{ mr: 1 }} />
          <ListItemText primary="设置" />
        </ListItemButton>
      </div>
    </List>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {isMobile ? (
        <>
          <AppBar position="fixed">
            <Toolbar>
              <IconButton color="inherit" edge="start" onClick={() => setDrawerOpen(true)}>
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                库存管理
              </Typography>
            </Toolbar>
          </AppBar>

          <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            {drawerContent}
          </Drawer>

          {/* Main content – push down below AppBar on mobile */}
          <Box component="main" sx={{ flexGrow: 1, width: "100%" }}>
            <Toolbar /> {/* spacer for AppBar height */}
            {children}
          </Box>
        </>
      ) : (
        <>
          {/* Permanent drawer on desktop */}
          <Drawer
            variant="permanent"
            anchor="left"
            sx={{
              width: DRAWER_WIDTH,
              flexShrink: 0,
              "& .MuiDrawer-paper": { width: DRAWER_WIDTH, boxSizing: "border-box" },
            }}
          >
            {drawerContent}
          </Drawer>

          {/* Main content */}
          <Box component="main" sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
            {children}
          </Box>
        </>
      )}
    </Box>
  );
}
