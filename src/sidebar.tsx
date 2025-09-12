import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  useMediaQuery,
} from "@mui/material";
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Inventory2,
  ExpandLess,
  ExpandMore,
  Settings,
  Assignment,
  AddBox,
  History,
  SyncAlt,
} from "@mui/icons-material";
import { useState } from "react";
import { useTheme } from "@mui/material/styles";

import { TabKey } from "./tabs"; // reuse your TabKey type

type SidebarProps = {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
};

export default function ResponsiveLayout({ activeTab, setActiveTab }: SidebarProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [stockOpen, setStockOpen] = useState(false);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (isMobile) setDrawerOpen(false);
  };

  const drawerContent = (
    <List>
      <ListItemButton onClick={() => handleTabChange("dashboard")}>
        <DashboardIcon sx={{ mr: 1 }} />
        <ListItemText primary="价值总览" />
      </ListItemButton>

      {/* Stock group */}
      <ListItemButton onClick={() => setStockOpen(!stockOpen)}>
        <Inventory2 sx={{ mr: 1 }} />
        <ListItemText primary="库存管理" />
        {stockOpen ? <ExpandLess /> : <ExpandMore />}
      </ListItemButton>
      <Collapse in={stockOpen} timeout="auto" unmountOnExit>
        <List component="div" disablePadding>
          <ListItemButton sx={{ pl: 4 }} onClick={() => handleTabChange("viewStock")}>
            <ListItemText primary="查看库存" />
          </ListItemButton>
          <ListItemButton sx={{ pl: 4 }} onClick={() => handleTabChange("addStock")}>
            <ListItemText primary="添加库存" />
          </ListItemButton>
          <ListItemButton sx={{ pl: 4 }} onClick={() => handleTabChange("removeStock")}>
            <ListItemText primary="移除库存" />
          </ListItemButton>
        </List>
      </Collapse>

      {/* Loans */}
      <ListItemButton onClick={() => handleTabChange("loanSummary")}>
        <Assignment sx={{ mr: 1 }} />
        <ListItemText primary="借货总览" />
      </ListItemButton>
      <ListItemButton onClick={() => handleTabChange("loanHistory")}>
        <History sx={{ mr: 1 }} />
        <ListItemText primary="借货记录" />
      </ListItemButton>
      <ListItemButton onClick={() => handleTabChange("addLoan")}>
        <AddBox sx={{ mr: 1 }} />
        <ListItemText primary="新增借货/归还" />
      </ListItemButton>

      {/* Product management */}
      <ListItemButton onClick={() => handleTabChange("productManagement")}>
        <SyncAlt sx={{ mr: 1 }} />
        <ListItemText primary="产品信息管理" />
      </ListItemButton>

      {/* Settings pinned at bottom */}
      <div style={{ marginTop: "auto", padding: "1rem" }}>
        <ListItemButton onClick={() => console.log("open settings")}>
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
          {/* Mobile AppBar with hamburger */}
          <AppBar position="fixed">
            <Toolbar>
              <IconButton
                color="inherit"
                edge="start"
                onClick={() => setDrawerOpen(true)}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                USANA库存管理
              </Typography>
            </Toolbar>
          </AppBar>

          {/* Mobile drawer */}
          <Drawer
            anchor="left"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          >
            {drawerContent}
          </Drawer>
        </>
      ) : (
        /* Desktop permanent sidebar */
        <Drawer variant="permanent" anchor="left">
          {drawerContent}
        </Drawer>
      )}
    </>
  );
}
