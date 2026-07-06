import type { MetadataRoute } from "next";

/** Served at /manifest.webmanifest — makes the app installable (PWA) and is
 * what PWABuilder/Bubblewrap read to package the Android APK. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PMS — The Placement OS",
    short_name: "PMS",
    description:
      "Placement management for Indian institutions — drives, offers, resume studio, and mentor connect.",
    id: "/",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0d14",
    theme_color: "#4f46e5",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
