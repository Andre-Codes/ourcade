import { createContext, useContext, useEffect } from "react";

// Lets a mounted React game tell the arcade shell (GamePage) whether the
// "‹ BACK TO ARCADE" chrome should be visible. The value is a setter function
// (or null when there's no provider, e.g. a game rendered standalone in tests).
export const ArcadeChromeContext = createContext(null);

// Call from inside a game component with `true` only on its title/main/hub
// screen. The button is hidden everywhere else so it never sits on top of the
// game's own top bar or menus. Restores the default (visible) on unmount.
export function useArcadeBackButton(visible) {
  const setVisible = useContext(ArcadeChromeContext);
  useEffect(() => {
    if (!setVisible) return undefined;
    setVisible(visible);
    return () => setVisible(true);
  }, [visible, setVisible]);
}
