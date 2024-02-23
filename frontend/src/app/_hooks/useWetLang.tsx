"use client";

import { Language } from "@arcnovus/wet-boew-react";
import { useParams } from "next/navigation";
import { useMemo } from "react";

export default function useWetLang() {
  const { locale } = useParams();
  return useMemo(() => {
    if (locale === "fr-CA") return Language.FR;
    return Language.EN;
  }, [locale]);
}
