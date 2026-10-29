import { redirect } from "next/navigation";

// The old single-site page: sites now live on the dashboard.
export default function MySitePage() {
  redirect("/painel");
}
