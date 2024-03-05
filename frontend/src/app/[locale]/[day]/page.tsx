import { getTranslations } from "next-intl/server";

import AppWrapper from "~/app/_components/AppWrapper";
import Graph from "~/app/_components/graph";
import TimeTravel from "~/app/_components/TimeTravel";

import countries from "~/countries.json";

export default async function Index({
  params,
}: {
  params: { day: string; locale: string };
}) {
  const t = await getTranslations("App");
  const timeTravelMsg = await getTranslations("TimeTravel");

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
          travelText: timeTravelMsg("travelText"),
        }}
      />
      <div className="flex flex-1 flex-col items-center justify-center overflow-hidden border-2 mb-10">
        <Graph countries={countries} />
      </div>
      {/* <div className="container">
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
                    [{dateToStr(params.locale, new Date(2019, 11, 22))}]
                  </time>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div> */}
    </AppWrapper>
  );
}
