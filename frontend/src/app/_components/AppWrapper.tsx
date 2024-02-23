"use client";

import { AppTemplate, useLngLinks } from "@arcnovus/wet-boew-react";
import { useParams } from "next/navigation";
import React from "react";
import useWetLang from "../_hooks/useWetLang";

export default function AppWrapper({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const { locale } = useParams();
  const lang = useWetLang();
  const { lngLinks } = useLngLinks({
    currentLanguage: lang,
    translatedPage: locale === "en-CA" ? "/fr-CA" : "/en-CA",
  });
  return (
    <AppTemplate
      appName={[{ text: title, href: `/${String(locale)}` }]}
      lngLinks={lngLinks}
      showShare={false}
      showFeedback={false}
    >
      {children}
    </AppTemplate>
  );
}
