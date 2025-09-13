// SidebarList.tsx
import {
  List,
  ListItemButton,
  ListItemText,
  Collapse,
} from "@mui/material";
import { ExpandLess, ExpandMore } from "@mui/icons-material";
import { useState } from "react";
import type { TabKey } from "../../tabs";
import type { SidebarItem } from "../../types/SidebarItem";

type SidebarListProps = {
  items: SidebarItem[];
  activeTab: TabKey;
  onSelect: (tab: TabKey) => void;
  depth?: number;
};

export function SidebarList({ items, activeTab, onSelect, depth = 0 }: SidebarListProps) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <List component="div" disablePadding>
      {items.map((item) => {
        if (item.children) {
          const groupOpen = openGroups[item.label] ?? false;
          return (
            <div key={item.label}>
              <ListItemButton onClick={() => toggleGroup(item.label)} sx={{ pl: 3 + depth * 2 }}>
                <ListItemText primary={item.label} />
                {groupOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              <Collapse in={groupOpen} timeout="auto" unmountOnExit>
                <SidebarList
                  items={item.children}
                  activeTab={activeTab}
                  onSelect={onSelect}
                  depth={depth + 1}
                />
              </Collapse>
            </div>
          );
        }

        return (
          <ListItemButton
            key={item.key!}
            sx={{ pl: 3 + depth * 2 }}
            selected={activeTab === item.key}
            onClick={() => onSelect(item.key!)}
          >
            <ListItemText primary={item.label} />
          </ListItemButton>
        );
      })}
    </List>
  );
}
