// SidebarList.tsx
import {
  List,
  ListItemButton,
  ListItemText,
  Collapse,
} from "@mui/material";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
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

  // Helper function to check if any child contains the active tab
  const containsActiveTab = (items: SidebarItem[], activeTab: TabKey): boolean => {
    return items.some(item => {
      if (item.key === activeTab) return true;
      if (item.children) return containsActiveTab(item.children, activeTab);
      return false;
    });
  };

  // Auto-expand groups that contain the active tab
  useEffect(() => {
    const newOpenGroups: Record<string, boolean> = {};
    
    items.forEach(item => {
      if (item.children && containsActiveTab(item.children, activeTab)) {
        newOpenGroups[item.label] = true;
      }
    });
    
    setOpenGroups(prev => ({ ...prev, ...newOpenGroups }));
  }, [activeTab, items]);

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
                {groupOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
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
