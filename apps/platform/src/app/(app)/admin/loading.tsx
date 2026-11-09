import { Skeleton, SkeletonHeading, SkeletonScreen } from "@/components/ui/skeleton";

// Inside the team area's frame (admin/layout.tsx): the title and the lists.
export default function Loading() {
  return (
    <SkeletonScreen className="grid gap-8">
      <SkeletonHeading />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-40 w-full rounded-xl" />
    </SkeletonScreen>
  );
}
