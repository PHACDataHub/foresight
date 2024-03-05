"use client";

import React, { useEffect } from "react";
import { WetProvider } from "@arcnovus/wet-boew-react";
import useWetLang from "~/app/_hooks/useWetLang";

declare global {
  interface Window {
    wet: object;
  }
}

export default function WithWet({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    window.wet = window.wet || {};
  }, []);
  const lang = useWetLang();
  return <WetProvider language={lang}>{children}</WetProvider>;
}
