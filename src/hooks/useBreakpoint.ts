import { useState, useEffect } from "react";

export type Breakpoint = "desktop" | "tablet" | "mobile";

const DESKTOP_QUERY = "(min-width: 1200px)";
const MOBILE_QUERY = "(max-width: 767px)";

function getBreakpoint(): Breakpoint {
  if (window.matchMedia(DESKTOP_QUERY).matches) return "desktop";
  if (window.matchMedia(MOBILE_QUERY).matches) return "mobile";
  return "tablet";
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(getBreakpoint);

  useEffect(() => {
    const desktopMql = window.matchMedia(DESKTOP_QUERY);
    const mobileMql = window.matchMedia(MOBILE_QUERY);

    const update = () => setBreakpoint(getBreakpoint());

    desktopMql.addEventListener("change", update);
    mobileMql.addEventListener("change", update);
    return () => {
      desktopMql.removeEventListener("change", update);
      mobileMql.removeEventListener("change", update);
    };
  }, []);

  return breakpoint;
}
