import { useTranslations } from "next-intl";
import AppWrapper from "../_components/AppWrapper";

export default function Index() {
  const t = useTranslations("App");

  return (
    <AppWrapper title={t("title")}>
      <h1> {t("title")}</h1>
    </AppWrapper>
  );
}
