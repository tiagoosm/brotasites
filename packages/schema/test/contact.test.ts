import { describe, expect, it } from "vitest";
import {
  applyCategory,
  buildPreviewConfig,
  formatPhone,
  formatZip,
  setAddress,
  setContact,
  setOpeningHours,
  setSocial,
  whatsappDigits,
} from "../src/index.js";

const bakery = () => applyCategory({ business: { name: "Padaria do Zé" } }, "Padaria");

describe("phone numbers", () => {
  it("stores WhatsApp as digits with the country code", () => {
    expect(whatsappDigits("(35) 99999-0000")).toBe("5535999990000");
    expect(whatsappDigits("35 3471-0000")).toBe("553534710000");
    expect(whatsappDigits("+55 35 99999-0000")).toBe("5535999990000");
    expect(whatsappDigits("9999")).toBe("9999");
  });

  it("formats numbers the way people write them", () => {
    expect(formatPhone("5535999990000")).toBe("(35) 99999-0000");
    expect(formatPhone("3534710000")).toBe("(35) 3471-0000");
    expect(formatPhone("359")).toBe("(35) 9");
    expect(formatPhone("3")).toBe("3");
  });

  it("formats ZIP codes", () => {
    expect(formatZip("37540000")).toBe("37540-000");
    expect(formatZip("3754")).toBe("3754");
  });
});

describe("contact in the preview", () => {
  it("shows the contact details the client typed", () => {
    let draft = setContact(bakery(), { whatsapp: "5535999990000", email: "ze@padaria.com.br" });
    draft = setAddress(draft, { street: "Rua Direita, 120", state: "MG", city: "Santa Rita" });
    draft = setSocial(draft, { instagram: "padariadoze" });
    const { business } = buildPreviewConfig(draft);
    expect(business.contact).toMatchObject({
      whatsapp: "5535999990000",
      email: "ze@padaria.com.br",
      address: { street: "Rua Direita, 120", state: "MG", city: "Santa Rita" },
    });
    expect(business.social?.instagram).toBe("padariadoze");
  });

  it("leaves out what is blank or still being typed", () => {
    let draft = setContact(bakery(), { whatsapp: "55359", email: "ze@", phone: "" });
    draft = setAddress(draft, { street: "", zip: "37540-000" });
    draft = setOpeningHours(draft, [
      { days: "Seg a Sex", hours: "06:00 - 19:00" },
      { days: "Sábado", hours: "" },
    ]);
    const { contact } = buildPreviewConfig(draft).business;
    expect(contact.whatsapp).toBeUndefined();
    expect(contact.email).toBeUndefined();
    expect(contact.phone).toBeUndefined();
    expect(contact.address).toEqual({ zip: "37540-000" });
    expect(contact.openingHours).toEqual([{ days: "Seg a Sex", hours: "06:00 - 19:00" }]);
  });
});
