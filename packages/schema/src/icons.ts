// Small inline icon set (24x24, stroke-based) shared by the templates and the form, so sites
// ship no icon library and the form shows the exact icon the site will use. Service icons in
// the config are these names; unknown names fall back to "star".

export const iconPaths = {
  bread:
    '<path d="M5 20h14a2 2 0 0 0 2-2v-5.5A6.5 6.5 0 0 0 14.5 6h-5A6.5 6.5 0 0 0 3 12.5V18a2 2 0 0 0 2 2z"/><path d="m9 10-1 2m5-2-1 2m5-2-1 2"/>',
  cake: '<path d="M4 21v-8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8"/><path d="M4 16c2 1.5 4 1.5 6 0s4-1.5 6 0 3 1 4 0"/><path d="M3 21h18M12 11V7"/><path d="M12 4.5c.8 0 1.2-.8 1.2-1.5L12 1.5 10.8 3c0 .7.4 1.5 1.2 1.5z"/>',
  coffee:
    '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M16 11h1.5a2.5 2.5 0 0 1 0 5H16M8 3v3m4-3v3"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  chat: '<path d="M21 12a8 8 0 0 1-11.8 7L4 20.5l1.5-4.9A8 8 0 1 1 21 12z"/><path d="M9 10h6m-6 3h4"/>',
  phone:
    '<path d="M5 3h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 12l5 2v3a2 2 0 0 1-2 2A14 14 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  instagram:
    '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  facebook: '<path d="M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h2.5l.5-4h-3V7a1 1 0 0 1 1-1h2z"/>',
} as const;

export type IconName = keyof typeof iconPaths;

/** Icons the client can pick for a service, with the name read to screen reader users. */
export const serviceIcons: { id: IconName; label: string }[] = [
  { id: "star", label: "Estrela" },
  { id: "check", label: "Visto" },
  { id: "bread", label: "Pão" },
  { id: "cake", label: "Bolo" },
  { id: "coffee", label: "Café" },
  { id: "chat", label: "Conversa" },
  { id: "clock", label: "Relógio" },
  { id: "pin", label: "Local" },
];

export function iconSvg(name: string | null | undefined): string {
  return iconPaths[(name && name in iconPaths ? name : "star") as IconName];
}
