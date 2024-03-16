import neo4j, {
  type Node,
  type Path,
  type QueryResult,
  type RecordShape,
} from "neo4j-driver";
import OgmaLib, {
  type Neo4JEdgeData,
  type Neo4JNodeData,
  type RawGraph,
  type RawNode,
} from "@linkurious/ogma";
import { z } from "zod";
import { env } from "~/env";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export type Neo4JNumber = { low: number; high: number };
export type Neo4JDate = {
  day: Neo4JNumber;
  month: Neo4JNumber;
  year: Neo4JNumber;
};

export interface Neo4JRecord<T1, T2, T3> {
  keys: string[];
  length: number;
  _fieldLookup: Record<string, number>;
  _fields: [T1, T2, T3];
}

export interface HierarchicalCluster {
  type: "hierarchicalcluster";
  clusters: number[];
  id: string;
  name: string;
}

export interface HierarchicalClusterRecord
  extends Omit<HierarchicalCluster, "clusters"> {
  clusters: Neo4JNumber[];
}

export interface Threat {
  type: "threat";
  title: string;
  score?: number;
}

export interface ThreatRecord extends Omit<Threat, "title"> {
  text: string;
}

export type ClusterQA = {
  score: number;
  question: string;
  answer: string;
};

export type ClusterLocation = {
  latitude: number;
  location: string;
  longitude: number;
};

export interface Cluster {
  type: "cluster";
  answers: Record<string, string>;
  countries: string[];
  id: string;
  keywords: string[];
  labels: string[];
  locations: ClusterLocation[];
  name: string;
  nr_articles: number;
  representative_docs: number[];
  start_date: Date;
  summary: string;
  title: string;
  topic_id: string;
  threats?: Threat[];

  // TODO: fix this
  location: ClusterLocation;
}

export interface ClusterRecord
  extends Omit<
    Cluster,
    | "start_date"
    | "representative_docs"
    | "locations"
    | "answers"
    | "nr_articles"
  > {
  answers: string;
  nr_articles: string;
  start_date: Neo4JDate;
  representative_docs: Neo4JNumber[];
  locations: string;
}

export type Article = {
  type: "article";
  content: string;
  factiva_file_name: string;
  factiva_folder: string;
  gphin_score: number;
  gphin_state: string;
  id: number;
  probability: number;
  pub_date: Date;
  pub_name: string;
  pub_time: Date;
  title: string;
};

export interface ArticleRecord
  extends Omit<Article, "id" | "pub_time" | "pub_date"> {
  id: string;
  pub_time: string;
  pub_date: Neo4JDate;
}

export interface EdgeRecord {
  elementId: string;
  end: Neo4JNumber;
  endNodeElementId: string;
  identity: Neo4JNumber;
  properties: {
    score: number;
  };
  start: Neo4JNumber;
  startNodeElementId: string;
  type: string;
}

export interface GraphResult extends Pick<QueryResult, "summary"> {
  records: Neo4JRecord<ClusterRecord, EdgeRecord, ThreatRecord>[];
}

export type AllRecordTypes =
  | ThreatRecord
  | ClusterRecord
  | HierarchicalClusterRecord
  | ArticleRecord;
export type AllDataTypes = Threat | Cluster | HierarchicalCluster | Article;

const translateGraph = (
  graph: RawGraph<
    Neo4JNodeData<Record<string, unknown>>,
    Neo4JEdgeData<Record<string, unknown>>
  >,
  nodeTranslate: (obj: RawNode<AllDataTypes>) => RawNode<AllDataTypes> = (
    obj,
  ) => obj,
): RawGraph<AllDataTypes, Neo4JEdgeData<Record<string, unknown>>> => {
  const g = graph as unknown as RawGraph<
    Neo4JNodeData<AllRecordTypes>,
    Neo4JEdgeData<Record<string, unknown>>
  >;
  return {
    nodes: g.nodes
      .map((n) => {
        if (n.data?.neo4jLabels.includes("Threat")) {
          const source = n.data?.neo4jProperties as ThreatRecord;
          const data: Threat = {
            type: "threat",
            title: source.text,
            score: source.score,
          };
          return { ...n, data };
        } else if (n.data?.neo4jLabels.includes("Cluster")) {
          const source = n.data?.neo4jProperties as ClusterRecord;
          const data: Cluster = {
            type: "cluster",
            answers: JSON.parse(source.answers) as Record<string, string>,
            countries: source.countries,
            id: source.id,
            keywords: source.keywords,
            labels: source.labels,
            locations: JSON.parse(
              source.locations ?? "[]",
            ) as ClusterLocation[],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            location: JSON.parse(source.locations ?? "[]").filter(
              (l: { latitude?: number, longitude?: number }) =>
                typeof l.latitude === "number" &&
                typeof l.longitude === "number",
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            )[0],
            // location: JSON.parse(
            //   source.locations ?? "[]",
            // )[0],
            name: source.name,
            nr_articles: parseInt(source.nr_articles),
            start_date: new Date(
              source.start_date.year.low,
              source.start_date.month.low,
              source.start_date.day.low,
            ),
            representative_docs: source.representative_docs.map((n) => n.low),
            summary: source.summary,
            title: source.title,
            topic_id: source.topic_id,
          };
          return { ...n, data };
        } else if (n.data?.neo4jLabels.includes("HierarchicalCluster")) {
          const source = n.data?.neo4jProperties as HierarchicalClusterRecord;
          const data: HierarchicalCluster = {
            type: "hierarchicalcluster",
            clusters: source.clusters.map((n) => n.low),
            id: source.id,
            name: source.name,
          };
          return { ...n, data };
        } else if (n.data?.neo4jLabels.includes("Article")) {
          const source = n.data?.neo4jProperties as ArticleRecord;
          const data: Article = {
            type: "article",
            content: source.content,
            factiva_file_name: source.factiva_file_name,
            factiva_folder: source.factiva_folder,
            gphin_score: source.gphin_score,
            gphin_state: source.gphin_state,
            id: parseInt(source.id),
            probability: source.probability,
            pub_date: new Date(
              source.pub_date.year.low,
              source.pub_date.month.low,
              source.pub_date.day.low,
            ),
            pub_name: source.pub_name,
            pub_time: new Date(source.pub_time),
            title: source.title,
          };
          return { ...n, data };
        } else {
          throw new Error("Unsupported node type!");
        }
      })
      .map((n) => nodeTranslate(n)),
    edges: g.edges,
  };
};

const driver = neo4j.driver(
  env.NEO4J_URL,
  neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD),
);

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  threats: publicProcedure.query(async () => {
    const session = driver.session();
    try {
      const result = await session.run(
        "MATCH (t:Threat) return t order by t.score DESC;",
      );
      return result.records
        .map((record) => {
          const t = record.get("t") as {
            properties: { text: string; score: number };
          };
          return { text: t.properties.text, score: t.properties.score ?? 0 };
        })
        .sort((a, b) => {
          if (a.score > b.score) return -1;
          if (a.score < b.score) return 1;
          return 0;
        });
    } finally {
      await session.close();
    }
  }),

  cluster: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const session = driver.session();
      try {
        const result = await session.run(
          `
        MATCH (c:Cluster {id: $id})-[]-(a:Article)
          OPTIONAL MATCH (c)-[]-(t:Threat)
        RETURN c,a,t
        `,
          { id: input.id },
        );
        return translateGraph(await OgmaLib.parse.neo4j(result));
        // if (result.records.length > 0) {
        //   const cluster = (result.records.at(0)?.get("c") as Node)
        //     .properties as Record<string, unknown>;

        //   const articles: Record<string, unknown> = {};
        //   const threats: Record<string, unknown> = {};
        //   const threatTitles: string[] = [];
        //   result.records.forEach((rec) => {
        //     const a = (rec.get("a") as Node).properties;
        //     const t = (rec.get("t") as Node).properties;
        //     const r2 = (rec.get("r2") as Node).properties;
        //     const article_id = `${(a.id as Neo4JNumber).low}`;
        //     const threat_id = `${(a.id as Neo4JNumber).low}`;
        //     if (!articles[article_id]) articles[article_id] = a;
        //     if (!threats[threat_id]) {
        //       const title = (t as { text: string }).text;
        //       if (!threatTitles.includes(title)) {
        //         threats[threat_id] = { t, r: r2 };
        //         threatTitles.push(title);
        //       }
        //     }
        //   });

        //   return {
        //     type: "cluster",
        //     answers: JSON.parse(
        //       (cluster.answers as string) ?? "[]",
        //     ) as ClusterQA[],
        //     id: cluster.id,
        //     nr_articles: parseInt(cluster.nr_articles as string),
        //     node_size: cluster.node_size,
        //     start_date: new Date(),
        //     summary: cluster.summary,
        //     title: cluster.title,
        //     topic_id: cluster.topic_id,
        //     primary_threat: cluster.primary_threat,
        //     threats: Object.entries(threats)
        //       .map(([_, o]) => {
        //         const d = o as Record<"t" | "r", Record<string, unknown>>;
        //         return {
        //           t: {
        //             type: "threat",
        //             title: d.t.text,
        //             score: d.t.score,
        //           },
        //           r: { score: d.r.score },
        //         } as { t: Threat; r: { score: number } };
        //       })
        //       .sort((a, b) => {
        //         if (a.r.score > b.r.score) return -1;
        //         if (a.r.score < b.r.score) return 1;
        //         if ((a.t.score ?? 0) > (b.t.score ?? 0)) return -1;
        //         if ((a.t.score ?? 0) < (b.t.score ?? 0)) return 1;
        //         return 0;
        //       }),
        //     articles: Object.entries(articles)
        //       .map(([_, o]) => {
        //         const d = o as Record<string, unknown>;
        //         return {
        //           pub_date: d.pub_date,
        //           gphin_state: d.gphin_state,
        //           factiva_folder: d.factiva_folder,
        //           pub_time: d.pub_time,
        //           pub_name: d.pub_name,
        //           factiva_file_name: d.factiva_file_name,
        //           id: d.id,
        //           gphin_score: d.gphin_score,
        //           title: d.title,
        //           content: d.content,
        //         } as Article;
        //       })
        //       .sort((a, b) => {
        //         if (a.gphin_score > b.gphin_score) return -1;
        //         if (a.gphin_score < b.gphin_score) return 1;
        //         return 0;
        //       }),
        //   } as Cluster;
        // }
      } finally {
        await session.close();
      }
    }),

  question: publicProcedure
    .input(
      z.object({
        cluster_id: z.string(),
        question: z.string(),
      }),
    )
    .query(async ({ input: { cluster_id, question } }) => {
      const session = driver.session();
      try {
        const result = await session.run(
          `
        MATCH (c:Cluster {id: $cluster_id}) 
        WITH c
          CALL apoc.load.jsonParams(
            "http://34.118.173.82:8000/answer_question", 
            {method: "POST", \`Content-Type\`:"application/json"}, 
            apoc.convert.toJson({fulltext: c.summary, question: $question})) YIELD value 
        RETURN value['answer'] AS answer
      
      `,
          { cluster_id, question },
        );
        const answer = result.records.at(0)?.get("answer") as string[];
        return answer;
      } finally {
        await session.close();
      }
    }),

  hierarchicalClusters: publicProcedure
    .input(
      z.object({
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
      }),
    )
    .query(async ({ input }) => {
      const session = driver.session();
      const baseDate = new Date("2019-12-01");
      baseDate.setDate(baseDate.getDate() + input.day - 1);

      let endDate = "";
      let startDate = "";

      if (input.history) {
        endDate = baseDate.toLocaleDateString("en-CA", {
          year: "numeric",
          month: "numeric",
          day: "numeric",
        });
        baseDate.setDate(baseDate.getDate() - input.history + 1);
      }

      startDate = baseDate.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });

      const period = `${startDate}${input.history ? `-${endDate}` : ""}`;
      try {
        const result = await session.run(
          `
        WITH $period + '-\\d+' AS id_pattern
          MATCH (c:Cluster)-[r:DETECTED_THREAT]->(t:Threat)
            WHERE c.id =~ id_pattern
        WITH c, collect(t) as threats
          MATCH path=(c)<-[:CONTAINS*..]-(:HierarchicalCluster)
        RETURN path, threats
        `,
          { period },
          // , threats: input.threats },
        );
        // AND t.text IN $threats
        const threats: Record<string, Threat[]> = {};
        const noThreats = {
          ...result,
          records: result.records.map((r) => {
            const nr: RecordShape = { ...r, keys: ["path"] };
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const threat = translateGraph({
              nodes:
                (nr._fields as Node[][]).pop()?.map((t) => ({
                  data: {
                    neo4jLabels: t.labels,
                    neo4jProperties: t.properties,
                  },
                })) ?? [],
              edges: [],
            }).nodes;

            if (threat) {
              const path = r.get("path") as Path;
              const cluster = path.start.identity.low;
              threats[cluster] = threat.map((t) => t.data as Threat);
            }
            nr.length = 1;
            nr._fieldLookup = { path: 0 };
            return nr;
          }),
        };
        return translateGraph(await OgmaLib.parse.neo4j(noThreats), (node) => {
          if (node.data?.type === "cluster" && node.id) {
            const threat = threats[node.id];
            return { ...node, data: { ...node.data, threats: threat } };
          }
          return node;
        });

        // return JSON.parse(JSON.stringify(result)) as GraphResult;
      } finally {
        await session.close();
      }
    }),

  // clusters: publicProcedure
  //   .input(
  //     z.object({
  //       day: z.number().gte(1).lte(62),
  //       history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
  //       // , threats: z.string().array()
  //     }),
  //   )
  //   .query(async ({ input }) => {
  //     const session = driver.session();
  //     const baseDate = new Date("2019-12-01");
  //     baseDate.setDate(baseDate.getDate() + input.day - 1);

  //     let endDate = "";
  //     let startDate = "";

  //     if (input.history) {
  //       endDate = baseDate.toLocaleDateString("en-CA", {
  //         year: "numeric",
  //         month: "numeric",
  //         day: "numeric",
  //       });
  //       baseDate.setDate(baseDate.getDate() - input.history + 1);
  //     }

  //     startDate = baseDate.toLocaleDateString("en-CA", {
  //       year: "numeric",
  //       month: "numeric",
  //       day: "numeric",
  //     });

  //     const period = `${startDate}${input.history ? `-${endDate}` : ""}`;
  //     try {
  //       const result = await session.run(
  //         `
  //       WITH $period + '-\\d+' AS id_pattern
  //         MATCH (c:Cluster)-[r:DETECTED_THREAT]->(t:Threat)
  //           WHERE c.id =~ id_pattern
  //       RETURN c, r, t
  //       ORDER BY r.score DESC
  //       `,
  //         { period },
  //         // , threats: input.threats },
  //       );
  //       // AND t.text IN $threats
  //       const threats: Record<string, string> = {};
  //       result.records.forEach((rec) => {
  //         const t = rec.get("t") as Node;
  //         if (!threats[t.elementId])
  //           threats[t.elementId] = t.properties.text as string;
  //       });

  //       result.records.forEach((rec) => {
  //         const c = rec.get("c") as Node;
  //         const r = rec.get("r") as EdgeRecord;
  //         const id =
  //           r.startNodeElementId === c.elementId
  //             ? r.endNodeElementId
  //             : r.startNodeElementId;
  //         c.properties.primary_threat = threats[id];
  //       });
  //       const g = await OgmaLib.parse.neo4j(result);
  //       const graph = {
  //         nodes: g.nodes.map((n) => {
  //           const data = n.data?.neo4jProperties;
  //           if (data && n.data?.neo4jLabels.includes("Threat")) {
  //             return {
  //               ...n,
  //               data: {
  //                 type: "threat",
  //                 title: (data.text as string) ?? "No text",
  //               } as Threat,
  //             };
  //           } else if (data && n.data?.neo4jLabels.includes("Cluster")) {
  //             return {
  //               ...n,
  //               data: {
  //                 type: "cluster",
  //                 answers: JSON.parse(
  //                   (data.answers as string) ?? "[]",
  //                 ) as ClusterQA[],
  //                 id: data.id,
  //                 nr_articles: parseInt(data.nr_articles as string),
  //                 node_size: data.node_size,
  //                 start_date: new Date(),
  //                 summary: data.summary,
  //                 title: data.title,
  //                 topic_id: data.topic_id,
  //                 primary_threat: data.primary_threat,
  //               } as Cluster,
  //             };
  //           } else return n;
  //         }),
  //         edges: g.edges,
  //       };
  //       return graph;

  //       // return JSON.parse(JSON.stringify(result)) as GraphResult;
  //     } finally {
  //       await session.close();
  //     }
  //   }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // simulate a slow db call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      return ctx.db.post.create({
        data: {
          name: input.name,
          createdBy: { connect: { id: ctx.session.user.id } },
        },
      });
    }),

  getLatest: protectedProcedure.query(({ ctx }) => {
    return ctx.db.post.findFirst({
      orderBy: { createdAt: "desc" },
      where: { createdBy: { id: ctx.session.user.id } },
    });
  }),

  getSecretMessage: protectedProcedure.query(() => {
    return "you can now see this secret message!";
  }),
});
