import { AuthShell } from "@/components/account/auth-shell";
import {
  Skeleton,
  SkeletonField,
  SkeletonHeading,
  SkeletonScreen,
  SkeletonSiteCard,
} from "@/components/ui/skeleton";

// The waiting screens of the account pages (E26, the loading.tsx of each segment): the same
// frame as the page that replaces them, so nothing jumps when it arrives.

/** Sign-in, sign-up and password pages: the account card with blocks for its fields. */
export function AuthSkeleton({
  light = false,
  wide = false,
  fields = 2,
}: {
  light?: boolean;
  wide?: boolean;
  fields?: number;
}) {
  return (
    <AuthShell light={light} wide={wide}>
      <SkeletonScreen className="grid gap-6 [@media(max-height:700px)]:gap-3">
        <SkeletonHeading />
        <div className={wide ? "grid gap-6 md:grid-cols-2 md:gap-x-5" : "grid gap-6"}>
          {Array.from({ length: fields }, (_, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: identical placeholder blocks
            <SkeletonField key={index} />
          ))}
        </div>
        <Skeleton className="h-12 w-full rounded-full" />
      </SkeletonScreen>
    </AuthShell>
  );
}

/** "Meus sites": the title row and two site cards. */
export function SitesSkeleton() {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-paper">
      <main className="mx-auto grid w-full max-w-[60rem] gap-8 px-5 pt-10 pb-20 sm:px-8">
        <SkeletonScreen label="Carregando os seus sites…" className="grid gap-8">
          <div className="grid gap-3">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-11 w-56" />
              <Skeleton className="h-12 w-44 rounded-full" />
            </div>
            <Skeleton className="h-5 w-72" />
          </div>
          <div className="grid gap-4">
            <SkeletonSiteCard />
            <SkeletonSiteCard />
          </div>
        </SkeletonScreen>
      </main>
    </div>
  );
}

/** A page with a title and a column of sections (a site's page, the account, the team). */
export function PageSkeleton({ width = "60rem" }: { width?: "44rem" | "60rem" | "72rem" }) {
  const max = { "44rem": "max-w-[44rem]", "60rem": "max-w-[60rem]", "72rem": "max-w-[72rem]" }[
    width
  ];
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-paper">
      <main className={`mx-auto grid w-full ${max} gap-8 px-5 pt-10 pb-20 sm:px-8`}>
        <SkeletonScreen className="grid gap-8">
          <SkeletonHeading />
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </SkeletonScreen>
      </main>
    </div>
  );
}

/** One step of the form, inside the form's frame: the step's title and its fields. */
export function StepSkeleton() {
  return (
    <SkeletonScreen className="grid gap-8 pb-10">
      <SkeletonHeading />
      <SkeletonField />
      <SkeletonField />
      <SkeletonField />
    </SkeletonScreen>
  );
}
