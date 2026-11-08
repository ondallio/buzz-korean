import { t as localize } from "@/shared/i18n";
export type Channel = {
  name: string;
  unread?: number;
  active?: boolean;
  variant: "public" | "private" | "direct";
};

export type ChannelSection = {
  title: string;
  items: Channel[];
};

export const sidebarSections: ChannelSection[] = [
  {
    get title() {
      return localize("Pinned");
    },
    items: [
      {
        name: "general",
        unread: 1,
        variant: "public",
      },
      {
        name: "product-launch",
        unread: 3,
        active: true,
        variant: "public",
      },
    ],
  },
  {
    get title() {
      return localize("Channels");
    },
    items: [
      {
        name: "engineering",
        variant: "public",
      },
      {
        name: "planning",
        variant: "private",
      },
    ],
  },
  {
    get title() {
      return localize("Direct Messages");
    },
    items: [
      {
        name: "Avery",
        variant: "direct",
      },
      {
        name: "Noa",
        variant: "direct",
      },
    ],
  },
];
