import type { SectionId } from "./sections.js";
import type { BodyFont, HeadingFont, Template } from "./site-config.js";

// Business categories offered in the form. Each one preselects a template, palettes, fonts and
// the sections that usually make sense for it; the client can change all of it later.

export interface Palette {
  id: string;
  /** pt-BR name shown in the form. */
  name: string;
  primary: string;
  secondary: string;
  background: string;
  text: string;
}

export const palettes = [
  {
    id: "forno",
    name: "Forno",
    primary: "#B45309",
    secondary: "#78350F",
    background: "#FFFBEB",
    text: "#1C1917",
  },
  {
    id: "cafe",
    name: "Café",
    primary: "#6F4E37",
    secondary: "#3B2A20",
    background: "#F7F1EA",
    text: "#211A16",
  },
  {
    id: "oliva",
    name: "Oliva",
    primary: "#556B2F",
    secondary: "#2F3D1A",
    background: "#F6F6EE",
    text: "#1B1F14",
  },
  {
    id: "pimenta",
    name: "Pimenta",
    primary: "#B91C1C",
    secondary: "#7F1D1D",
    background: "#FFF7F5",
    text: "#1F1513",
  },
  {
    id: "navalha",
    name: "Navalha",
    primary: "#1E3A5F",
    secondary: "#0F1F33",
    background: "#F4F5F7",
    text: "#111827",
  },
  {
    id: "couro",
    name: "Couro",
    primary: "#8B4513",
    secondary: "#3E2723",
    background: "#FAF6F1",
    text: "#1A1410",
  },
  {
    id: "rosa-cha",
    name: "Rosa chá",
    primary: "#9D4E6A",
    secondary: "#5E2A3E",
    background: "#FDF7F8",
    text: "#24161C",
  },
  {
    id: "lavanda",
    name: "Lavanda",
    primary: "#6B5B95",
    secondary: "#3D3261",
    background: "#F8F7FC",
    text: "#1C1A27",
  },
  {
    id: "salvia",
    name: "Sálvia",
    primary: "#4F7A65",
    secondary: "#2C4A3C",
    background: "#F4F8F5",
    text: "#16201B",
  },
  {
    id: "oceano",
    name: "Oceano",
    primary: "#0E6E8C",
    secondary: "#0A4A5E",
    background: "#F3F8FA",
    text: "#10212A",
  },
  {
    id: "grafite",
    name: "Grafite",
    primary: "#374151",
    secondary: "#111827",
    background: "#F5F5F4",
    text: "#111111",
  },
  {
    id: "energia",
    name: "Energia",
    primary: "#E11D48",
    secondary: "#111827",
    background: "#FAFAFA",
    text: "#0A0A0A",
  },
  {
    id: "citrico",
    name: "Cítrico",
    primary: "#0F766E",
    secondary: "#134E4A",
    background: "#F7FAF9",
    text: "#102A27",
  },
  {
    id: "noite",
    name: "Noite",
    primary: "#E3A857",
    secondary: "#3A2A1C",
    background: "#14110F",
    text: "#F5EFE6",
  },
  {
    id: "papel",
    name: "Papel",
    primary: "#2F5D50",
    secondary: "#1F3B33",
    background: "#FBFBF8",
    text: "#1A1A1A",
  },
] as const satisfies readonly Palette[];

export type PaletteId = (typeof palettes)[number]["id"];

export interface CategoryPreset {
  id: string;
  /** pt-BR label shown in the form and used as `business.category`. */
  label: string;
  template: Template;
  /** First palette is the default. */
  palettes: [PaletteId, PaletteId, PaletteId];
  fonts: { heading: HeadingFont; body: BodyFont };
  /** Sections enabled by default, in addition to hero and contact which are always on. */
  sections: SectionId[];
}

const everything: SectionId[] = ["sobre", "servicos", "galeria", "faq", "cta-final"];
const noGallery: SectionId[] = ["sobre", "servicos", "faq", "cta-final"];

export const categories = [
  {
    id: "padaria",
    label: "Padaria",
    template: "classico",
    palettes: ["forno", "cafe", "papel"],
    fonts: { heading: "Playfair Display", body: "Inter" },
    sections: everything,
  },
  {
    id: "confeitaria",
    label: "Confeitaria",
    template: "classico",
    palettes: ["rosa-cha", "forno", "lavanda"],
    fonts: { heading: "Playfair Display", body: "Poppins" },
    sections: everything,
  },
  {
    id: "restaurante",
    label: "Restaurante",
    template: "classico",
    palettes: ["pimenta", "oliva", "noite"],
    fonts: { heading: "Playfair Display", body: "Inter" },
    sections: everything,
  },
  {
    id: "cafeteria",
    label: "Cafeteria",
    template: "classico",
    palettes: ["cafe", "papel", "noite"],
    fonts: { heading: "Lora", body: "Inter" },
    sections: everything,
  },
  {
    id: "barbearia",
    label: "Barbearia",
    template: "classico",
    palettes: ["navalha", "couro", "noite"],
    fonts: { heading: "Roboto Slab", body: "Inter" },
    sections: everything,
  },
  {
    id: "salao",
    label: "Salão de beleza",
    template: "classico",
    palettes: ["rosa-cha", "lavanda", "papel"],
    fonts: { heading: "Playfair Display", body: "Poppins" },
    sections: everything,
  },
  {
    id: "estetica",
    label: "Estética e bem-estar",
    template: "classico",
    palettes: ["salvia", "lavanda", "papel"],
    fonts: { heading: "Lora", body: "Inter" },
    sections: everything,
  },
  {
    id: "academia",
    label: "Academia",
    template: "classico",
    palettes: ["energia", "grafite", "navalha"],
    fonts: { heading: "Montserrat", body: "Inter" },
    sections: everything,
  },
  {
    id: "oficina",
    label: "Oficina mecânica",
    template: "classico",
    palettes: ["grafite", "navalha", "pimenta"],
    fonts: { heading: "Montserrat", body: "Roboto" },
    sections: noGallery,
  },
  {
    id: "loja",
    label: "Loja",
    template: "classico",
    palettes: ["citrico", "papel", "forno"],
    fonts: { heading: "Poppins", body: "Inter" },
    sections: everything,
  },
  {
    id: "saude",
    label: "Consultório e saúde",
    template: "classico",
    palettes: ["oceano", "salvia", "papel"],
    fonts: { heading: "Montserrat", body: "Inter" },
    sections: noGallery,
  },
  {
    id: "servicos",
    label: "Serviços profissionais",
    template: "classico",
    palettes: ["navalha", "oceano", "papel"],
    fonts: { heading: "Lora", body: "Inter" },
    sections: noGallery,
  },
  {
    id: "pet",
    label: "Pet shop",
    template: "classico",
    palettes: ["citrico", "oliva", "forno"],
    fonts: { heading: "Poppins", body: "Inter" },
    sections: everything,
  },
  {
    id: "outro",
    label: "Outro",
    template: "classico",
    palettes: ["papel", "oceano", "forno"],
    fonts: { heading: "Inter", body: "Inter" },
    sections: noGallery,
  },
] as const satisfies readonly CategoryPreset[];

export type CategoryId = (typeof categories)[number]["id"];

export function findPalette(id: string | undefined): Palette | undefined {
  return palettes.find((palette) => palette.id === id);
}

/** Finds a preset by id or by label (the label is what ends up in the config). */
export function findCategory(value: string | undefined): CategoryPreset {
  const normalized = value?.trim().toLowerCase();
  return (
    categories.find((c) => c.id === normalized || c.label.toLowerCase() === normalized) ??
    (categories.find((c) => c.id === "outro") as CategoryPreset)
  );
}
