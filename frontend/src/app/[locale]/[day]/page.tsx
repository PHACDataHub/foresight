import { useTranslations } from "next-intl";

import Image from "next/image";
import AppWrapper from "~/app/_components/AppWrapper";
import TimeTravel from "~/app/_components/TimeTravel";
import useDateToStr from "~/app/_hooks/useDateToStr";
// import Map from "~/app/_components/Map";

// import geojson from "~/custom.geo.json";

export default function Index({
  params,
}: {
  params: { day: string; locale: string };
}) {
  const t = useTranslations("App");
  const timeTravelMsg = useTranslations("TimeTravel");
  const dateToStr = useDateToStr(params.locale);

  const startDate = new Date(2019, 11, 1, 12);
  const endDate = new Date(2020, 0, 31, 12);
  const date = new Date(startDate);
  date.setDate(date.getDate() + parseInt(params.day) - 1);

  return (
    <AppWrapper title={t("title")}>
      <TimeTravel
        startDate={startDate}
        endDate={endDate}
        date={date}
        messages={{
          chooseDate: timeTravelMsg("chooseDate"),
          currentDate: timeTravelMsg("currentDate"),
          travelText: timeTravelMsg("travelText"),
          startButton: timeTravelMsg("startButton"),
          nextButton: timeTravelMsg("nextButton"),
          lastButton: timeTravelMsg("lastButton"),
          previousButton: timeTravelMsg("previousButton"),
        }}
      />
      <div className="container">
        <div className="row">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`article_cluster_${i}`} className="col-md-4">
              <div className="hght-inhrt">
                <div className="hidden-xs hidden-sm">
                  <Image
                    src="/fake.gif"
                    className="img-responsive mrgn-bttm-md thumbnail"
                    alt="This is not a real cluster"
                    width={1280}
                    height={813}
                  />
                </div>
                <h3>
                  <a
                    href="/2023/03/22/top-tasks.html"
                    className="stretched-link"
                  >
                    AI generated name of article cluster goes here
                  </a>
                </h3>
                <ul className="list-inline">
                  <li>
                    <span className="label label-danger">Detected Disease</span>
                  </li>
                  <li>
                    <span className="label label-info">Topic</span>
                  </li>
                </ul>
                <p>
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi
                  sodales odio mauris, eu efficitur quam fringilla quis. Nunc
                  consectetur lobortis eros, vel ultrices leo convallis
                  vehicula. Nulla facilisi. Curabitur justo tellus, hendrerit
                  sit amet commodo sed, ornare ut sapien. Duis lobortis eros
                  leo, ac porttitor metus mattis sed. Mauris congue libero
                  dolor, varius vulputate libero consectetur a. Phasellus auctor
                  rhoncus sagittis. Cras egestas magna vitae felis dapibus
                  consectetur. Mauris a lectus feugiat, elementum magna vitae,
                  lacinia eros. Sed ullamcorper nunc eget quam venenatis
                  malesuada.{" "}
                </p>
                <p className="small">
                  <time dateTime="2019-12-22" className="nowrap">
                    [{dateToStr(new Date(2019, 11, 22))}]
                  </time>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppWrapper>
  );
}
