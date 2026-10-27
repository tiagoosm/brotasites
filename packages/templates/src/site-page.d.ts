// The "@site-page" alias points at the 1.1 or the 1.2 page, depending on the config being built.
declare module "@site-page" {
  const Page: (props: { config: unknown }) => unknown;
  export default Page;
}
