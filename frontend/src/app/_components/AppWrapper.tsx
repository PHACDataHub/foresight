"use client";

import { useParams } from "next/navigation";
import React, { useCallback } from "react";
import { AppTemplate, useLngLinks } from "@arcnovus/wet-boew-react";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { useTranslations } from "next-intl";
import useWetLang from "~/app/_hooks/useWetLang";
import { useStore } from "~/app/_store";

export default function AppWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { locale } = useParams();
  const lang = useWetLang();
  const { lngLinks } = useLngLinks({
    currentLanguage: lang,
    translatedPage: locale === "en-CA" ? "/fr-CA/1" : "/en-CA/1",
  });

  const { appError, registerError } = useStore();
  const t = useTranslations();

  const handleErrorClose = useCallback(() => {
    registerError("");
  }, [registerError]);

  return (
    <div className="flex h-full max-h-[100%] min-h-[100%] flex-col">
      <AppTemplate
        appName={[]}
        lngLinks={lngLinks}
        showShare={false}
        showFeedback={false}
        showPostContent={false}
      >
        <div className="flex flex-1 flex-col">{children}</div>
        {Boolean(appError) && (
          <Snackbar
            open
            onClose={handleErrorClose}
            sx={{}}
            autoHideDuration={6000}
          >
            <Alert
              onClose={handleErrorClose}
              severity="error"
              variant="filled"
              sx={{
                width: "100%",
                fontSize: 16,
                "& button>svg": { fontSize: 20 },
              }}
            >
              {t(appError)}
            </Alert>
          </Snackbar>
        )}
      </AppTemplate>
    </div>
  );
}
