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
} from "@mui/material";
import { Menu as MenuIcon, Settings } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { useState } from "react";
import type { TabKey } from "../../tabs";
import { sidebarStructure } from "../../tabs";
import { SidebarList } from "./SidebarList";

type ResponsiveLayoutProps = {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  onOpenSettings?: () => void;
};

export default function ResponsiveLayout({
  activeTab,
  setActiveTab,
  onOpenSettings,
}: ResponsiveLayoutProps) {
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
    <>
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
        </>
      ) : (
        <Drawer variant="permanent" anchor="left">
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}
