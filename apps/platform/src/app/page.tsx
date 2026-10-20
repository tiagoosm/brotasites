import { redirect } from "next/navigation";

// No marketing page yet: the product starts at the form.
export default function Home() {
  redirect("/criar/negocio");
}
