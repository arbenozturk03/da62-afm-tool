import { Outlet } from "react-router-dom";
import BottomTabBar, { BOTTOM_TAB_BAR_HEIGHT } from "../components/navigation/BottomTabBar";

export default function AppLayout() {
  return (
    <>
      <main
        style={{
          paddingBottom: `calc(${BOTTOM_TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))`,
          minHeight: "100vh",
        }}
      >
        <Outlet />
      </main>
      <BottomTabBar />
    </>
  );
}
