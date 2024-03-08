"use client";

import Image from "next/image";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { api } from "~/trpc/react";
import { useStore } from "~/app/_store";
import { type ClusterRecord } from "~/server/api/routers/post";

export default function TextView() {
  const { day: dayStr } = useParams<{ day: string }>();
  const { history } = useStore();

  const day = parseInt(dayStr);

  const { data } = api.post.articles.useQuery(
    { day, history },
    {
      refetchOnWindowFocus: false,
    },
  );

  const clusters = useMemo(() => {
    const c: Record<string, ClusterRecord> = {};
    const sort: Record<string, number> = {};
    if (data && Array.isArray(data.records)) {
      data.records.forEach((record) => {
        if (!c[record._fields[0].elementId]) {
          c[record._fields[0].elementId] = record._fields[0];
        }
        if (!sort[record._fields[0].elementId]) {
          sort[record._fields[0].elementId] = 0;
        }
        sort[record._fields[0].elementId] += 1;
      });
      return Object.entries(c).map(([_, r]) => r);
      // .sort((a, b) => {
      //   if (sort[a.elementId] > sort[b.elementId])
      //     return -1;
      //   if (sort[a.elementId] < sort[b.elementId])
      //     return 1;
      //   return 0;
      // });
    }
    return [];
  }, [data]);

  return (
    <div className="container">
      <div className="row">
        {clusters.map((cluster, i) => (
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
                <a className="stretched-link">{cluster.properties.title}</a>
              </h3>
              <ul className="list-inline">
                <li>
                  <span className="label label-danger">Detected Disease</span>
                </li>
                <li>
                  <span className="label label-info">Topic</span>
                </li>
              </ul>
              <p>{cluster.properties.summary}</p>
              <p className="small">
                <time dateTime="2019-12-22" className="nowrap">
                  [muffins]
                </time>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
