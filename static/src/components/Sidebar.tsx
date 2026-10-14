/**
 * Sidebar — ChatGPT-style left navigation panel.
 * Includes: nav links, theme toggle, new-chat button, user badge.
 */
import React from "react";
import { MessageSquare, FileText, Settings, Sun, Moon, Zap, PanelLeftClose, PanelLeft } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export type Page = "chat" | "documents" | "settings";

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
}

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "chat",      label: "Chat",      icon: <MessageSquare size={18} /> },
  { id: "documents", label: "Documents", icon: <FileText size={18} /> },
  { id: "settings",  label: "Settings",  icon: <Settings size={18} /> },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  collapsed,
  onToggleCollapse,
  onNewChat,
}) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className="sidebar"
      style={{ width: collapsed ? 60 : 240 }}
      aria-label="Main navigation"
    >
      {/* Top — logo + collapse */}
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-logo">
            <Zap size={16} className="sidebar-logo-icon" />
            <span className="sidebar-logo-text">Anveshan RAG</span>
          </div>
        )}
        <button
          className="sidebar-icon-btn"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* New Chat button */}
      <div className="sidebar-section">
        <button className="new-chat-btn" onClick={onNewChat} title="New conversation">
          <span className="new-chat-plus">+</span>
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" role="navigation">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-nav-item ${activePage === item.id ? "active" : ""}`}
            onClick={() => onNavigate(item.id)}
            title={collapsed ? item.label : undefined}
            aria-current={activePage === item.id ? "page" : undefined}
          >
            <span className="sidebar-nav-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-nav-label">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* Bottom — theme toggle + user */}
      <div className="sidebar-footer">
        <button
          className="sidebar-icon-btn theme-toggle"
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          {!collapsed && (
            <span className="sidebar-footer-label">
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </span>
          )}
        </button>

        <div className="sidebar-user" title="SV-402 — Admin Tier 3">
          <div className="sidebar-avatar">SV</div>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">SV-402</span>
              <span className="sidebar-user-role">Admin Tier 3</span>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
