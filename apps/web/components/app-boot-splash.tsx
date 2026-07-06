"use client";

import { AppSplash } from "./app-splash";

/** Root-level app opening: visible only in the installed app (TWA/PWA),
 * from the first paint, over whichever page the app launches into. */
export function AppBootSplash() {
  return <AppSplash ready standaloneOnly />;
}
