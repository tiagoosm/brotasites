import { redirect } from "next/navigation";

// The old single-site page: sites now live on "Meus sites".
export default function MySitePage() {
  redirect("/meus-sites");
}
