"use client";

import { useStore } from "~/app/_store";

export default function WorkingWith() {
  const { articleCount } = useStore();
  if (articleCount === 0) return;

  return (
    <div className="mt-4 text-xl">
      You are working with{" "}
      <span className="text-3xl">{articleCount.toLocaleString()}</span>{" "}
      articles.
    </div>
  );
}
