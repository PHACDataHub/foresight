"use client";

import useParamsWithStore from "~/app/_hooks/useParamsWithStore";

export default function Index({ params }: { params: { clusterId: string } }) {
  useParamsWithStore(params);
  return <></>;
}
