import { useTranslations } from "next-intl";
import AppWrapper from "../_components/AppWrapper";
import TimeTravel from "../_components/TimeTravel";

export default function Index() {
  const t = useTranslations("App");
  const timeTravelMsg = useTranslations("TimeTravel");

  return (
    <AppWrapper title={t("title")}>
      <TimeTravel
        messages={{
          chooseDate: timeTravelMsg("chooseDate"),
          currentDate: timeTravelMsg("currentDate"),
          travelText: timeTravelMsg("travelText"),
        }}
      />
    </AppWrapper>
  );
}
