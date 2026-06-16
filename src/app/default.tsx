// Required by the @modal parallel route slot. Next.js needs a `default` export
// for the implicit `children` slot too — without it, soft (client-side)
// navigations fail to reconcile the parallel slots and silently no-op, so links
// only work via hard navigation (middle-click / refresh). Returns null because
// `children` always matches a real segment; this only satisfies the router's
// fallback requirement. See: https://nextjs.org/docs/app/api-reference/file-conventions/default
export default function Default() {
  return null;
}
