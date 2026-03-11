"use client";

import dynamic from "next/dynamic";

const CreateUpdateModal = dynamic(
  () => import("@/components/feed/CreateUpdateModal").then((m) => ({ default: m.CreateUpdateModal })),
  { ssr: false }
);

export { CreateUpdateModal as LazyCreateUpdateModal };
