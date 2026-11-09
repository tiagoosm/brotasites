import { Skeleton, SkeletonHeading, SkeletonScreen } from "@/components/ui/skeleton";

// Inside the site pages' frame ((site)/layout.tsx): the title and the sections.
export default function Loading() {
  return (
    <SkeletonScreen className="grid gap-8">
      <SkeletonHeading />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </SkeletonScreen>
  );
}
