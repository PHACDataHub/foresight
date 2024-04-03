import neo4j, {
  type Integer as Neo4jInteger,
  type QueryResult,
} from "neo4j-driver";
import OgmaLib, {
  type Neo4JEdgeData,
  type Neo4JNodeData,
  type RawGraph,
  type RawNode,
} from "@linkurious/ogma";
import { z } from "zod";

import { env } from "~/env";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

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
  answers?: Record<string, string>;
  countries?: string[];
  id: string;
  keywords?: string[];
  labels?: string[];
  locations?: ClusterLocation[];
  name?: string;
  nr_articles: number;
  representative_docs?: number[];
  start_date?: Date;
  summary: string;
  title: string;
  topic_id?: string;
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
  outlier: boolean;
  content?: string;
  factiva_file_name?: string;
  factiva_folder?: string;
  gphin_score?: number;
  gphin_state?: string;
  id: number;
  prob_size: number;
  probability?: number;
  pub_date?: Date;
  pub_name?: string;
  pub_time?: Date;
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

export type AllDataTypeProperties =
  | "threat"
  | "cluster"
  | "hierarchicalcluster"
  | "article";

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
            // location: JSON.parse(source.locations ?? "[]").filter(
            //   (l: { latitude?: number; longitude?: number }) =>
            //     typeof l.latitude === "number" &&
            //     typeof l.longitude === "number",
            //   // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            // )[0],
            // location: JSON.parse(
            //   source.locations ?? "[]",
            // )[0],
            name: source.name,
            nr_articles: parseInt(source.nr_articles),
            start_date: new Date(
              source.start_date.year.low,
              source.start_date.month.low - 1,
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
            outlier: n.data.neo4jLabels.includes("Outlier"),
            content: source.content,
            factiva_file_name: source.factiva_file_name,
            factiva_folder: source.factiva_folder,
            gphin_score: source.gphin_score,
            gphin_state: source.gphin_state,
            id: parseInt(source.id),
            prob_size: source.prob_size,
            probability: source.probability,
            pub_date: new Date(
              source.pub_date.year.low,
              source.pub_date.month.low - 1,
              source.pub_date.day.low,
              5,
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

  nodesWithTerms: publicProcedure
    .input(z.object({ terms: z.array(z.string()) }))
    .query(async ({ input }) => {
      const session = driver.session();
      try {
        const result = await session.run(
          `
        UNWIND $terms AS term 
        MATCH (n:Cluster) 
          WHERE toLower(n.title) CONTAINS term OR toLower(n.summary) CONTAINS term 
        return n
        UNION
        UNWIND $terms AS term 
        MATCH (n:Article) 
          WHERE toLower(n.title) CONTAINS term OR toLower(n.content) CONTAINS term 
        return n        
        `,
          { terms: input.terms },
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
          MATCH (c:Cluster {id: $id})<-[r:IN_CLUSTER]-(a:Article)
            WITH c, r, a
              OPTIONAL MATCH (a)-[r_sim:SIMILAR_TO]-(oa)-[:IN_CLUSTER]-(c)
          RETURN c, r, a, r_sim
    `,
          { id: input.id },
        );
        return translateGraph(await OgmaLib.parse.neo4j(result));
      } finally {
        await session.close();
      }
    }),

  expandCluster: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const session = driver.session();
      try {
        const result = await session.run(
          `
          MATCH (c:Cluster {id: $id})<-[r:IN_CLUSTER]-(a:Article)
            WITH c, r, a
              OPTIONAL MATCH (a)-[r_sim:SIMILAR_TO]-(oa)-[:IN_CLUSTER]-(c)
          RETURN c, r, a, r_sim
    `,
          { id: input.id },
        );
        return translateGraph(await OgmaLib.parse.neo4j(result));
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
    .mutation(async ({ input: { cluster_id, question } }) => {
      if (question.length < 3) {
        return ["Question is too short."];
      }
      const session = driver.session();
      try {
        const result = await session.run(
          `
        MATCH (c:Cluster {id: $cluster_id}) 
        WITH c
          CALL apoc.load.jsonParams(
            $qa_service_url, 
            {method: "POST", \`Content-Type\`:"application/json"}, 
            apoc.convert.toJson({fulltext: c.summary, question: $question})) YIELD value 
        RETURN value['answer'] AS answer
      
      `,
          { cluster_id, question, qa_service_url: env.QA_SERVICE_URL },
        );
        const answer = result.records.at(0)?.get("answer") as string[];
        return answer;
      } finally {
        await session.close();
      }
    }),

  articles: publicProcedure
    .input(
      z.object({
        cluster_id: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const session = driver.session();

      try {
        const result = await session.run(
          `
          MATCH (a:Article)-[r:IN_CLUSTER]->(c:Cluster {id: $cluster_id})
          WITH c, r, a
            OPTIONAL MATCH (a)-[r_sim:SIMILAR_TO]-(oa)-[:IN_CLUSTER]-(c)
          RETURN 
            a, r_sim
        `,
          { cluster_id: input.cluster_id },
        );

        return translateGraph(await OgmaLib.parse.neo4j(result));
      } finally {
        await session.close();
      }
    }),

  hierarchicalClustersArticleCount: publicProcedure
    .input(
      z.object({
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
        everything: z.boolean().optional(),
        threats: z.array(z.string()),
      }),
    )
    .query(async ({ input }) => {
      const session = driver.session();
      const baseDate = new Date("2019-12-01");
      baseDate.setDate(baseDate.getDate() + input.day - 1);

      let endDate = "";
      let startDate = "";

      if (input.history) {
        if (input.history === 30 && input.everything) {
          throw new Error("Unable to process everything for 30 days.");
        }
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
        const counter = await session.run(
          `
        WITH $period + '-\\d+' AS id_pattern
          MATCH (c:Cluster)-[r:DETECTED_THREAT]->(t:Threat)
            WHERE c.id =~ id_pattern AND t.text IN $threats
        WITH c
          MATCH articles=(a:Article)-[r:IN_CLUSTER]->(c)
        RETURN count(a) as count
        `,
          { period, threats: input.threats },
        );
        for (const r of counter.records) {
          const count = r.get("count") as Neo4jInteger;
          return count.toNumber();
        }
        return 0;
      } finally {
        await session.close();
      }
    }),
  hierarchicalClusters: publicProcedure
    .input(
      z.object({
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
        everything: z.boolean().optional(),
        threats: z.array(z.string()),
      }),
    )
    .query(async ({ input }) => {
      const session = driver.session();
      const baseDate = new Date("2019-12-01");
      baseDate.setDate(baseDate.getDate() + input.day - 1);

      let endDate = "";
      let startDate = "";

      if (input.history) {
        if (input.history === 30 && input.everything) {
          throw new Error("Unable to process everything for 30 days.");
        }
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
        const ts = new Date();
        console.log(
          `[${ts.toLocaleTimeString()}] --- hierarchicalClusters QUERY START ---`,
        );
        const result = await session.run(
          `
        WITH $period + '-\\d+' AS id_pattern
          MATCH (hr:HierarchicalCluster)-[hr_r:CONTAINS*..]->(c:Cluster)-[r:DETECTED_THREAT]->(t:Threat)
            WHERE c.id =~ id_pattern AND t.text IN $threats

          ${
            input.everything
              ? `WITH hr, hr_r, c, r, t
            OPTIONAL MATCH (c)<-[r2:IN_CLUSTER]-(a:Article)
          WITH hr, hr_r, c, r, t, r2, a
            OPTIONAL MATCH (a)-[r_sim:SIMILAR_TO]-(oa)-[:IN_CLUSTER]-(c)
`
              : ""
          }
        RETURN hr, hr_r, c , r, t ${input.everything ? ", a, r2, r_sim" : ""}
        `,
          { period, threats: input.threats },
        );
        const te1 = new Date();
        console.log(
          `[${te1.toLocaleTimeString()}] --- Neo4J Query Completed in ${((te1.getTime() - ts.getTime()) / 1000).toFixed(2)} seconds. ---`,
        );

        const ret = translateGraph(await OgmaLib.parse.neo4j(result), (n) => {
          if (!input.everything) return n;
          if (n.data?.type === "cluster")
            return {
              ...n,
              data: {
                type: "cluster",
                id: n.data.id,
                locations: n.data.locations,
                nr_articles: n.data.nr_articles,
                title: n.data.title,
                summary: n.data.summary,
              },
            };
          if (n.data?.type === "article")
            return {
              ...n,
              data: {
                type: "article",
                id: n.data.id,
                outlier: n.data.outlier,
                prob_size: n.data.prob_size,
                title: n.data.title,
              },
            };

          return n;
        });
        const te2 = new Date();
        console.log(
          `[${te2.toLocaleTimeString()}] --- Graph Translation Completed in ${((te2.getTime() - te1.getTime()) / 1000).toFixed(2)} seconds. ---`,
        );

        return ret;
      } finally {
        await session.close();
      }
    }),
});
