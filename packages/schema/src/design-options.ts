import type { SectionId } from "./sections.js";
import type { BodyFont, HeadingFont, Template } from "./site-config.js";

// Options offered in the form's design questions. Labels and descriptions are pt-BR.

export interface TemplateOption {
  id: Template;
  name: string;
  description: string;
  available: boolean;
}

export const templateOptions: TemplateOption[] = [
  {
    id: "classico",
    name: "Clássico",
    description:
      "Título grande, foto em arco e a placa de aberto ou fechado. Elegante e acolhedor.",
    available: true,
  },
  {
    id: "moderno",
    name: "Moderno",
    description: "Blocos de cor e tipografia firme, para quem quer chamar atenção.",
    available: false,
  },
  {
    id: "minimalista",
    name: "Minimalista",
    description: "Muito espaço em branco e poucas cores. O conteúdo fala sozinho.",
    available: false,
  },
  {
    id: "vibrante",
    name: "Vibrante",
    description: "Cores fortes e movimento, para negócios cheios de energia.",
    available: false,
  },
];

export interface FontPairing {
  id: string;
  name: string;
  heading: HeadingFont;
  body: BodyFont;
}

export const fontPairings: FontPairing[] = [
  { id: "classica", name: "Clássica", heading: "Playfair Display", body: "Inter" },
  { id: "acolhedora", name: "Acolhedora", heading: "Lora", body: "Inter" },
  { id: "elegante", name: "Elegante", heading: "Playfair Display", body: "Poppins" },
  { id: "firme", name: "Firme", heading: "Roboto Slab", body: "Inter" },
  { id: "moderna", name: "Moderna", heading: "Montserrat", body: "Inter" },
  { id: "amigavel", name: "Amigável", heading: "Poppins", body: "Inter" },
  { id: "direta", name: "Direta", heading: "Montserrat", body: "Roboto" },
  { id: "neutra", name: "Neutra", heading: "Inter", body: "Inter" },
];

export function findPairing(heading?: string, body?: string): FontPairing | undefined {
  return fontPairings.find((p) => p.heading === heading && p.body === body);
}

export interface SectionInfo {
  id: SectionId;
  name: string;
  description: string;
  /** Always on and always first. */
  locked?: boolean;
}

export const sectionInfo: SectionInfo[] = [
  {
    id: "hero",
    name: "Topo",
    description: "Nome, frase de apresentação e o botão principal.",
    locked: true,
  },
  { id: "sobre", name: "Sobre", description: "A história do negócio e o que ele tem de especial." },
  {
    id: "servicos",
    name: "Serviços",
    description: "O que você oferece, com uma linha sobre cada item.",
  },
  {
    id: "galeria",
    name: "Galeria de fotos",
    description: "Fotos do espaço, dos produtos ou do trabalho.",
  },
  {
    id: "depoimentos",
    name: "Depoimentos",
    description: "Opiniões reais de clientes. Só aparece se você cadastrar pelo menos uma.",
  },
  {
    id: "faq",
    name: "Perguntas frequentes",
    description: "Respostas para as dúvidas que mais aparecem.",
  },
  { id: "cta-final", name: "Chamada final", description: "Um último convite para falar com você." },
  { id: "contato", name: "Contato e mapa", description: "Endereço, horários, WhatsApp e mapa." },
];
