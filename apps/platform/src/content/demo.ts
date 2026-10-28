import { findCategory, findPalette } from "@brotasites/schema";

// The home page demo: a few business types with an example title each. These titles are
// fixed sample copy written here (no AI, nothing generated), shown only in the demo and
// labeled as example text.

export interface DemoType {
  /** Category id of the 1.1 catalog, for the sample colors and font. */
  id: string;
  /** Category id of schema 1.2, sent to the form. */
  category: string;
  label: string;
  title: string;
  font: string;
  colors: { primary: string; background: string; text: string };
}

const demo: { id: string; category: string; title: string }[] = [
  { id: "padaria", category: "padaria", title: "Pão quentinho todo dia" },
  { id: "salao", category: "salao-beleza", title: "Seu cabelo em boas mãos" },
  { id: "barbearia", category: "barbearia", title: "Corte e barba sem pressa" },
  { id: "oficina", category: "oficina-mecanica", title: "Seu carro bem cuidado" },
  { id: "cafeteria", category: "cafeteria", title: "Um café feito com calma" },
  { id: "pet", category: "pet-shop", title: "Cuidado de verdade para o seu pet" },
];

export const demoTypes: DemoType[] = demo.map(({ id, category: categoryId, title }) => {
  const category = findCategory(id);
  const palette = findPalette(category.palettes[0]);
  return {
    id,
    category: categoryId,
    label: category.label,
    title,
    font: category.fonts.heading,
    colors: {
      primary: palette?.primary ?? "#2F7A4A",
      background: palette?.background ?? "#FFFFFF",
      text: palette?.text ?? "#14241B",
    },
  };
});

export const DEMO_DEFAULT = { name: "Padaria do Zé", type: "padaria" };

/** Google Fonts for the demo titles, loaded only once the visitor picks a type. */
export const DEMO_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Playfair+Display&family=Roboto+Slab&family=Montserrat:wght@600&family=Lora&family=Poppins:wght@500&display=swap";
