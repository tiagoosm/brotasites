import { cn } from "@/lib/utils";

// "Sair": a form posted to /auth/sair (same-origin checked there), back to the home page.
export function SignOutButton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <form action="/auth/sair" method="post" className="contents">
      <input type="hidden" name="voltar" value="/" />
      <button type="submit" style={style} className={cn("touch-target text-left", className)}>
        Sair
      </button>
    </form>
  );
}
