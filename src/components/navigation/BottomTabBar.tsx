import { NavLink } from "react-router-dom";

const TAB_BAR_HEIGHT = 64;

export const BOTTOM_TAB_BAR_HEIGHT = TAB_BAR_HEIGHT;

const iconSize = 22;

const TABS = [
  { to: "/config", label: "Config", icon: "/icons/config.png" },
  { to: "/wb", label: "W&B", icon: "/icons/takeoff.png" },
  { to: "/takeoff", label: "Takeoff", icon: "/icons/wb.png" },
  { to: "/landing", label: "Landing", icon: "/icons/landing.png" },
] as const;

export default function BottomTabBar() {
  return (
    <nav
      className="bottom-tab-bar"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: TAB_BAR_HEIGHT,
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "space-around",
        width: "100%",
        maxWidth: 1440,
        margin: "0 auto",
        backgroundColor: "var(--panel-bg)",
        borderTop: "1px solid var(--panel-border)",
        zIndex: 100,
      }}
    >
      {TABS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `bottom-tab-bar__item ${isActive ? "bottom-tab-bar__item--active" : ""}`
          }
        >
          <span className="bottom-tab-bar__icon" style={{ ["--icon-url" as string]: `url(${icon})` }} aria-hidden>
            <img src={icon} alt="" width={iconSize} height={iconSize} />
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
