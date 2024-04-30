"use client";

import React, { useCallback, useEffect, useMemo } from "react";

import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import { useTranslations } from "next-intl";

import { useParams } from "next/navigation";
import { useStore } from "~/app/_store";
import GocTheme from "./GocTheme";

const alertSx = {
  width: "100%",
  fontSize: 16,
  "& button>svg": { fontSize: 20 },
};

export default function AppWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { appError, registerError } = useStore();
  const { locale } = useParams();
  const t = useTranslations();

  const displayAppError = useMemo(() => Boolean(appError), [appError]);
  const appErrorText = useMemo(() => appError && t(appError), [t, appError]);

  const handleErrorClose = useCallback(() => {
    registerError("");
  }, [registerError]);

  useEffect(() => {
    if (typeof locale === "string")
      document.querySelector("html")?.setAttribute("lang", locale);
  }, [locale]);

  return (
    <div className="flex h-full max-h-[100%] min-h-[100%] flex-col">
      <GocTheme>
        <div className="flex flex-1 flex-col">{children}</div>
        {displayAppError && (
          <Snackbar open onClose={handleErrorClose} autoHideDuration={6000}>
            <Alert
              onClose={handleErrorClose}
              severity="error"
              variant="filled"
              sx={alertSx}
            >
              {appErrorText}
            </Alert>
          </Snackbar>
        )}
      </GocTheme>
    </div>
  );
}
