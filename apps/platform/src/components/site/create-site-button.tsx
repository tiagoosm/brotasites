"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { buttonVariants } from "@/components/ui/button";
import { SpecularLayers, useSpecular } from "@/components/ui/specular";
import { cn } from "@/lib/utils";
import { LinkPending, useIntentPrefetch } from "./link-pending";
import { CREATE_HREF } from "./nav";

// The main green link to creating a site or an account ("Criar meu site", "Criar conta"), with
// the shared specular finish of every main action (components/ui/specular.tsx, E30), the
// intent prefetch and the pending arrow.

export function CreateSiteButton({
  href = CREATE_HREF,
  children = "Criar meu site",
  size = "lg",
  arrow = true,
  className,
  onClick,
}: {
  href?: string;
  children?: React.ReactNode;
  /** "nav": the header's smaller button, with a quieter light. */
  size?: "lg" | "nav";
  arrow?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const link = useRef<HTMLAnchorElement>(null);
  const intent = useIntentPrefetch(href);
  useSpecular(link);

  return (
    <Link
      ref={link}
      href={href}
      prefetch={false}
      {...intent}
      onClick={onClick}
      data-create-site=""
      className={cn(
        buttonVariants({ size: "lg" }),
        "specular group",
        size === "nav" && "specular-nav h-11 px-4 text-sm lg:px-5 lg:text-[0.9375rem]",
        className,
      )}
    >
      <SpecularLayers />
      {children}
      {arrow && (
        <ArrowRight
          aria-hidden="true"
          className="transition-transform duration-200 group-hover:translate-x-0.5"
        />
      )}
      <LinkPending dot={false} />
    </Link>
  );
}
