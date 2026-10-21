import type { Cta, SiteConfig } from "@brotasites/schema";

export interface Link {
  href: string;
  external: boolean;
}

export function whatsappUrl(number: string): string {
  return `https://wa.me/${number}`;
}

/** Brazilian numbers have up to 11 digits with area code; longer ones already include the country code. */
export function phoneUrl(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `tel:+${digits.length <= 11 ? `55${digits}` : digits}`;
}

/** The profile name from "@padaria", "padaria" or a profile address with or without https. */
export function socialHandle(value: string, host: "instagram.com" | "facebook.com"): string {
  const site =
    host === "instagram.com" ? /^(www\.)?instagram\.com\//i : /^(www\.|m\.)?facebook\.com\//i;
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(site, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "");
}

export function instagramUrl(value: string): string {
  return `https://www.instagram.com/${encodeURIComponent(socialHandle(value, "instagram.com"))}`;
}

export function facebookUrl(value: string): string {
  return `https://www.facebook.com/${encodeURIComponent(socialHandle(value, "facebook.com"))}`;
}

/** The main contact link: WhatsApp when available, otherwise the contact section. */
export function primaryContactLink(config: SiteConfig): Link {
  const whatsapp = config.business.contact.whatsapp;
  return whatsapp
    ? { href: whatsappUrl(whatsapp), external: true }
    : { href: "#contato", external: false };
}

export function ctaLink(cta: Cta, config: SiteConfig): Link {
  const { contact } = config.business;
  switch (cta.action) {
    case "whatsapp":
      return primaryContactLink(config);
    case "phone": {
      const phone = cta.target ?? contact.phone;
      return phone ? { href: phoneUrl(phone), external: false } : primaryContactLink(config);
    }
    case "link":
      return cta.target ? { href: cta.target, external: true } : primaryContactLink(config);
    case "scroll":
      return { href: `#${(cta.target ?? "contato").replace(/^#/, "")}`, external: false };
  }
}
