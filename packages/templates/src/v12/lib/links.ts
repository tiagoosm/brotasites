import { type Cta, isSafeHref, type SiteConfig } from "@brotasites/schema/v1.2";

// Every link a 1.2 site has is built here from the business contact. Only https, wa.me, tel: and
// mailto: links exist (docs/security.md); the config itself never holds a URL.

export interface Link {
  href: string;
  external: boolean;
}

type Business = SiteConfig["business"];

/** Every link goes through this: anything that is not an allowed link becomes "#". */
export function safe(href: string): string {
  return isSafeHref(href) ? href : "#";
}

export const whatsappHref = (number: string) => safe(`https://wa.me/${number}`);

/** tel: link with the country code (numbers are stored as digits, 55 optional). */
export function phoneHref(phone: string): string {
  return safe(`tel:+${phone.length <= 11 ? `55${phone}` : phone}`);
}

export const emailHref = (email: string) => safe(`mailto:${email}`);

/** One line of the address, for display and for the "Como chegar" search. */
export function addressLine(business: Business): string {
  const { street, number, district, city, state } = business.address;
  const first = [street, number].filter(Boolean).join(", ");
  return [first, district, `${city} - ${state}`].filter(Boolean).join(", ");
}

/** "Como chegar": a map search for the address, opened in the visitor's maps app or site. */
export function directionsHref(business: Business): string {
  const query = `${business.name}, ${addressLine(business)}`;
  return safe(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
}

export const instagramHref = (user: string) =>
  safe(`https://www.instagram.com/${encodeURIComponent(user)}`);
export const facebookHref = (page: string) =>
  safe(`https://www.facebook.com/${encodeURIComponent(page)}`);

/** The main way to reach the business: WhatsApp, else phone, else email, else the contact section. */
export function primaryContact(business: Business): Link {
  const { whatsapp, phone, email } = business.contact;
  if (whatsapp) return { href: whatsappHref(whatsapp), external: true };
  if (phone) return { href: phoneHref(phone), external: false };
  if (email) return { href: emailHref(email), external: false };
  return { href: "#contato", external: false };
}

export function ctaLink(cta: Cta, business: Business): Link {
  const { contact } = business;
  switch (cta.action) {
    case "whatsapp":
      return contact.whatsapp
        ? { href: whatsappHref(contact.whatsapp), external: true }
        : primaryContact(business);
    case "phone":
      return contact.phone
        ? { href: phoneHref(contact.phone), external: false }
        : primaryContact(business);
    case "email":
      return contact.email
        ? { href: emailHref(contact.email), external: false }
        : primaryContact(business);
    case "directions":
      return { href: directionsHref(business), external: true };
    case "section":
      return { href: `#${cta.section ?? "contato"}`, external: false };
  }
}

/** "(35) 3555-0000" or "(35) 99999-0000" from stored digits. */
export function formatPhone(digits: string): string {
  const local = digits.length > 11 ? digits.slice(2) : digits;
  const area = local.slice(0, 2);
  const rest = local.slice(2);
  const cut = rest.length === 9 ? 5 : 4;
  return `(${area}) ${rest.slice(0, cut)}-${rest.slice(cut)}`;
}
