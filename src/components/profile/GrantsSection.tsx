"use client";

import { GrantsInput } from "./GrantsInput";
import { updateGrantsAction } from "@/app/profile/grants-actions";

interface Props {
  initialGrants: string[];
}

export function GrantsSection({ initialGrants }: Props) {
  return (
    <GrantsInput
      initialGrants={initialGrants}
      onSave={updateGrantsAction}
    />
  );
}
