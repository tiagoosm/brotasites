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

export function instagramUrl(handle: string): string {
  return /^https?:\/\//.test(handle)
    ? handle
    : `https://www.instagram.com/${handle.replace(/^@/, "")}`;
}

export function facebookUrl(handle: string): string {
  return /^https?:\/\//.test(handle) ? handle : `https://www.facebook.com/${handle}`;
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
