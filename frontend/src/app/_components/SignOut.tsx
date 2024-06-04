"use client";

import { Button } from "@mui/material";
import { signIn, signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect } from "react";

export default function SignOut() {
  const t = useTranslations("SignOut");
  const session = useSession();
  const handleClick = useCallback(async () => {
    await signOut({ callbackUrl: "/" });
  }, []);

  useEffect(() => {
    if (session.status === "unauthenticated") void signIn();
  }, [session]);

  if (session.status !== "authenticated") return;
  return (
    <li className="signout">
      <Button onClick={handleClick}>{t("button")}</Button>
    </li>
  );
}
