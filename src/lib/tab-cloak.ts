import type { TabCloakPreset, TabCloakPresetId } from "./types";

export const TAB_CLOAK_PRESETS: TabCloakPreset[] = [
  { id: "default", name: "Hypers0nic", title: "Hypers0nic", icon: "/icon.png" },
  {
    id: "classroom",
    name: "Classroom",
    title: "Home - Classroom",
    icon: "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Ffreepnglogo.com%2Fimages%2Fall_img%2Fgoogle-classroom-9634.png&f=1&nofb=1&ipt=a1ca0c52fcf6dd60992466a97d2185d79fc090b86e7b5e6ca431fc99c64d07a7",
  },
  {
    id: "google",
    name: "Google",
    title: "Google",
    icon: "https://www.google.com/favicon.ico",
  },
  {
    id: "drive",
    name: "Google Drive",
    title: "My Drive - Google Drive",
    icon: "https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png",
  },
  {
    id: "docs",
    name: "Google Docs",
    title: "Untitled document - Google Docs",
    icon: "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico",
  },
  {
    id: "gmail",
    name: "Gmail",
    title: "Inbox (1) - Gmail",
    icon: "https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico",
  },
  {
    id: "canvas",
    name: "Canvas",
    title: "Dashboard",
    icon: "https://canvas.instructure.com/favicon.ico",
  },
  {
    id: "powerschool",
    name: "PowerSchool",
    title: "PowerSchool",
    icon: "https://powerschool.com/favicon.ico",
  },
  { id: "custom", name: "Custom", title: "Custom", icon: "" },
];

export function getPreset(id: TabCloakPresetId): TabCloakPreset {
  return TAB_CLOAK_PRESETS.find((p) => p.id === id) ?? TAB_CLOAK_PRESETS[0];
}

export function applyTabCloak(
  presetId: TabCloakPresetId,
  customTitle?: string,
  customIcon?: string
) {
  const preset = getPreset(presetId);

  let title: string;
  let icon: string;

  if (presetId === "custom") {
    title = customTitle || "Hypers0nic";
    icon = customIcon || "/icon.png";
  } else if (presetId === "classroom") {
    title = customTitle || preset.title;
    icon = customIcon || preset.icon;
  } else {
    title = preset.title;
    icon = preset.icon || "/icon.png";
  }

  document.title = title;
  setFavicon(icon);
}

export function setFavicon(href: string) {
  const existing = document.querySelectorAll<HTMLLinkElement>("link[rel='icon']");
  existing.forEach((el) => el.remove());
  const link = document.createElement("link");
  link.rel = "icon";
  link.href = href;
  document.head.appendChild(link);
}
