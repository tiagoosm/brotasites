// The frame of the sign-in, sign-up and password pages: one quiet column under the header.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-paper px-5 py-12">
      <div className="step-enter w-full max-w-[26rem]">{children}</div>
    </main>
  );
}
