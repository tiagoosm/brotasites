import type { Metadata } from "next";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Esqueci a senha", robots: { index: false } };

export default function Page() {
  return <ForgotPasswordForm />;
}
