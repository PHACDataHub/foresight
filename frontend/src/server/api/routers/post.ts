import neo4j, {
  type Integer as Neo4jInteger,
  type QueryResult,
  type Relationship,
} from "neo4j-driver";
import OgmaLib, {
  type Neo4JEdgeData,
  type Neo4JNodeData,
  type RawEdge,
  type RawGraph,
  type RawNode,
} from "@linkurious/ogma";
import { z } from "zod";

import { env } from "~/env";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

interface RawGraphInterface {
  nodes: RawNode[];
  edges: RawEdge[];
  edge_index: Record<string, boolean>;
  get: () => { nodes: RawNode<AllDataTypes>[]; edges: RawEdge[] };
}

const ans = `apoc.convert.fromJsonMap(
  apoc.text.replace(
    apoc.text.replace(
      apoc.text.replace(
        cluster.answers,
        "What date did the disease start\\?",
        "What date did the disease start to spread?"
      ),
      "What is the possible source of the disease\\?",
      "What is the likely source of the disease?"
    ),
    "What geo location does the disease spread\\?",
    "Where is the disease currently spreading?"
  )
)`;

const getPeriod = ({ day, history }: { day: number; history?: number }) => {
  const baseDate = new Date("2019-12-01");
  baseDate.setDate(baseDate.getDate() + day - 1);

  let endDate = "";
  let startDate = "";

  if (history) {
    endDate = baseDate.toLocaleDateString("en-CA", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    });
    baseDate.setDate(baseDate.getDate() - history + 1);
  }
  startDate = baseDate.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  return `${startDate}${history ? `-${endDate}` : ""}`;
};

const createGraph = () => {
  const nodes: RawNode[] = [];
  const edges: RawEdge[] = [];
  const rawGraph: RawGraphInterface = {
    nodes,
    edges,
    edge_index: {},
    get: () => ({
      nodes,
      edges,
    }),
  };
  return rawGraph;
};
const addEdge = (edge: Relationship, rawGraph: RawGraphInterface) => {
  const id = edge.identity.toString();

  if (rawGraph.edge_index[id]) return;
  rawGraph.edge_index[id] = true;

  rawGraph.edges.push({
    id,
    data: {
      neo4jType: edge.type,
    },
    source: edge.start.toString(),
    target: edge.end.toString(),
  });
};

const addEdges = (
  edge: Relationship | Relationship[] | Relationship[][] | undefined,
  rawGraph: RawGraphInterface,
) => {
  if (!edge) return;
  if (!Array.isArray(edge)) return addEdge(edge, rawGraph);
  edge.forEach((e) => {
    if (!Array.isArray(e)) return addEdge(e, rawGraph);
    e.forEach((ed) => addEdge(ed, rawGraph));
  });
};

const parseData = (
  obj: Neo4JTransferRecord,
  rawGraph: RawGraphInterface,
  include_articles: boolean | undefined,
) => {
  const id = `${obj.nodeid.toNumber()}`;
  rawGraph.nodes.push({
    id,
    data: convertNeo4jTypes(obj),
  });
  addEdges(obj._rels, rawGraph);

  if (obj.type === "hierarchicalcluster") {
    obj._clusters.forEach((cluster) => {
      parseData(cluster, rawGraph, include_articles);
    });
  } else if (obj.type === "cluster") {
    if (include_articles)
      obj._articles.forEach((articles) =>
        parseData(articles, rawGraph, include_articles),
      );
  } else if (obj.type === "article") {
    addEdges(obj._similar, rawGraph);
  }
};

const funcTimer = (msg: string) => {
  const width = 80;
  const start = new Date();
  let marked = start;
  const prefix = `[${start.toLocaleTimeString()}]`;
  const label = `${prefix} ${msg}`;
  console.log(`${label} ${"#".repeat(width - label.length - 1)}`);

  return {
    measure: (title: string, mark?: boolean) => {
      const end = new Date();
      const elapsed = (end.getTime() - marked.getTime()).toLocaleString(
        "en-CA",
        {
          notation: "compact",
          style: "unit",
          unit: "millisecond",
          unitDisplay: "narrow",
        },
      );
      const prefix = `[${end.toLocaleTimeString()}] ${elapsed}`;
      const label = `${prefix} ${title}`;
      console.log(`${label}${" ".repeat(width - label.length - 1)}#`);
      if (mark) marked = new Date();
    },
    msg: (title: string, mark?: boolean) => {
      const end = new Date();
      const prefix = `[${end.toLocaleTimeString()}]`;
      const label = `${prefix} ${title}`;
      console.log(`${label}${" ".repeat(width - label.length - 1)}#`);
      if (mark) marked = new Date();
    },
    payload: (data: unknown[], mark?: boolean) => {
      const end = new Date();
      const prefix = `[${end.toLocaleTimeString()}]`;
      const payload = (JSON.stringify(data).length - 4).toLocaleString(
        "en-CA",
        {
          notation: "compact",
          style: "unit",
          unit: "byte",
          unitDisplay: "narrow",
        },
      );
      const label = `${prefix} PAYLOAD: ${payload}`;
      console.log(`${label}${" ".repeat(width - label.length - 1)}#`);
      if (mark) marked = new Date();
    },
    mark: () => {
      marked = new Date();
    },
    end: () => {
      const end = new Date();
      const elapsed = (end.getTime() - start.getTime()).toLocaleString(
        "en-CA",
        {
          notation: "compact",
          style: "unit",
          unit: "millisecond",
          unitDisplay: "narrow",
        },
      );
      const label = `[${end.toLocaleTimeString()}] Total time: ${elapsed}`;
      console.log(`${label} ${"#".repeat(width - label.length - 1)}`);
    },
  };
};

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

export type Neo4JTransferRecord =
  | (Neo4JTransferRecordInterface & {
      type: Exclude<
        AllDataTypeProperties,
        "hierarchicalcluster" | "cluster" | "article"
      >;
    })
  | (Neo4JTransferRecordInterface & {
      type: "hierarchicalcluster";
      _clusters: Neo4JTransferRecord[];
    })
  | (Neo4JTransferRecordInterface & {
      type: "cluster";
      _articles: Neo4JTransferRecord[];
    })
  | (Neo4JTransferRecordInterface & {
      type: "article";
      _similar: Relationship[];
    });

export interface Neo4JTransferRecordInterface
  extends Record<
    string,
    | string
    | Date
    | null
    | number
    | Neo4jInteger
    | Neo4JTransferRecord[]
    | Relationship[][]
    | Relationship
    | undefined
  > {
  nodeid: Neo4jInteger;
  _rels?: Relationship[][] | Relationship;
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
  data__incomplete__?: boolean;
  cluster_id: string;
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

const convertNeo4jTypes = (obj: Neo4JTransferRecord) => {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([key]) => !key.startsWith("_") && key !== "nodeid")
      .map(([key, value]) => {
        if (neo4j.isInt(value)) return [key, value.toNumber()];
        if (neo4j.isDate(value) || neo4j.isDateTime(value))
          return [key, value.toStandardDate()];
        if (key === "pub_time" && typeof value === "string")
          return [key, new Date(value)];
        return [key, value];
      }),
  );
};

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
            cluster_id: "",
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
    .input(
      z.object({
        terms: z.array(z.string()),
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
        everything: z.boolean().optional(),
        threats: z.array(z.string()),
      }),
    )
    .query(async ({ input }) => {
      const session = driver.session();
      const period = getPeriod({ day: input.day, history: input.history });

      try {
        const result = await session.run(
          `
        WITH $period + '-\\d+' AS id_pattern
        UNWIND $terms AS term 
        MATCH (c:Cluster)-[:DETECTED_THREAT]->(t:Threat)
          WHERE 
            (c.id =~ id_pattern AND t.text IN $threats) AND (
              (toLower(c.title) CONTAINS term OR toLower(c.summary) CONTAINS term)
              OR EXISTS {
                MATCH (c)<-[:IN_CLUSTER]-(a:Article)
                  WHERE toLower(a.title) CONTAINS term OR toLower(a.content) CONTAINS term 
              }
            )
        return c.id as id
        UNION
        WITH $period + '-\\d+' AS id_pattern
        UNWIND $terms AS term 
        MATCH (a:Article)-[:IN_CLUSTER]->(c:Cluster)-[r:DETECTED_THREAT]->(t:Threat)
          WHERE
            c.id =~ id_pattern AND t.text IN $threats AND (
              toLower(a.title) CONTAINS term OR toLower(a.content) CONTAINS term 
            )
        return a.id as id
        `,
          { terms: input.terms, period, threats: input.threats },
        );
        return result.records.map((record) => {
          const id = record.get("id") as string;
          return `${id}`;
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
    .mutation(async ({ input }) => {
      const session = driver.session();
      try {
        const t = funcTimer("cluster NEW Query");
        const result = await session.run(
          `
          MATCH (cluster:Cluster {id: $id})
          RETURN cluster {
            nodeid: id(cluster),
            type: "cluster",
            answers: ${ans},
            countries: cluster.countries,
            id: cluster.id,
            keywords: cluster.keywords,
            labels: cluster.labels,
            locations: apoc.convert.fromJsonList(cluster.locations),
            name: cluster.name,
            nr_articles: cluster.nr_articles,
            state_date: cluster.start_date,
            representative_docs: cluster.representative_docs,
            summary: cluster.summary,
            title: cluster.title,
            topic_id: cluster.topic_id,
            _articles: [(cluster)<-[r:IN_CLUSTER]-(article:Article) | article {
              nodeid: id(article),
              cluster_id: cluster.id,
              type: "article",
              _rels: r,
              _similar: [(article)-[r_sim:SIMILAR_TO]-(oa)-[:IN_CLUSTER]-(cluster) | r_sim],
              .id,
              outlier: article:Outlier,
              .prob_size,
              .title,
              .content,
              .factiva_file_name,
              .factiva_folder,
              .gphin_score,
              .gphin_state,
              .probability,
              .pub_date,
              .pub_name,
              .pub_time
            }]
          }
    `,
          { id: input.id },
        );
        t.measure("Neo4J query completed");
        t.payload([result.records], true);
        const rawGraph = createGraph();
        result.records.forEach((record) => {
          const data = record.get("cluster") as Neo4JTransferRecord;
          parseData(data, rawGraph, true);
        });
        t.measure("Graph translation complete.");
        t.payload([rawGraph]);
        return rawGraph;
      } finally {
        await session.close();
      }
    }),

  getArticle: publicProcedure
    .input(
      z.object({
        article_id: z.number(),
        cluster_id: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const session = driver.session();
      try {
        const t = funcTimer("getArticle NEW Query");
        const result2 = await session.run(
          `
        MATCH (article:Article { id: $article_id })
        RETURN article {
          nodeid: id(article),
          type: "article",
          cluster_id: $cluster_id,
          .id,
          outlier: article:Outlier,
          .prob_size,
          .title,
          .content,
          .factiva_file_name,
          .factiva_folder,
          .gphin_score,
          .gphin_state,
          .probability,
          .pub_date,
          .pub_name,
          .pub_time
        }
      `,
          { article_id: input.article_id, cluster_id: input.cluster_id },
        );
        t.measure("Neo4J query completed");
        t.payload([result2.records], true);

        const rawGraph = createGraph();
        result2.records.forEach((record) => {
          const data = record.get("article") as Neo4JTransferRecord;
          parseData(data, rawGraph, false);
        });
        t.measure("Graph translation complete.");
        t.payload([rawGraph]);
        t.end();
        return rawGraph.get();
      } finally {
        await session.close();
      }
    }),

  getArticles: publicProcedure
    .input(
      z.object({
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
        threats: z.array(z.string()),
      }),
    )
    .mutation(async ({ input }) => {
      const session = driver.session();
      const period = getPeriod({ day: input.day, history: input.history });
      try {
        const t = funcTimer("getArticles NEW Query");
        const result2 = await session.run(
          `
        WITH $period + '-\\d+' AS id_pattern
        MATCH (c:Cluster)<-[r:IN_CLUSTER]-(article:Article)
        WHERE
          c.id =~ id_pattern AND
          EXISTS {
            (c)-[:DETECTED_THREAT]->(t:Threat WHERE t.text IN $threats)
          }
        RETURN article {
          nodeid: id(article),
          type: "article",
          cluster_id: c.id,
          _rels: r,
          _similar: [(article)-[r_sim:SIMILAR_TO]-(oa)-[:IN_CLUSTER]-(c) | r_sim],
          .id,
          outlier: article:Outlier,
          .prob_size,
          .title,
          data__incomplete__: true
        }
      `,
          { period, threats: input.threats },
        );
        t.measure("Neo4J query completed");
        t.payload([result2.records], true);

        const rawGraph = createGraph();
        result2.records.forEach((record) => {
          const data = record.get("article") as Neo4JTransferRecord;
          parseData(data, rawGraph, false);
        });
        t.measure("Graph translation complete.");
        t.payload([rawGraph]);
        t.end();
        return rawGraph.get();
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
      const period = getPeriod({ day: input.day, history: input.history });

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
      const period = getPeriod({ day: input.day, history: input.history });

      try {
        const t = funcTimer("hierarchicalClusters NEW Query");
        const threats = await session.run(
          `
          WITH $period + '-\\d+' AS id_pattern
          MATCH (threat:Threat WHERE threat.text IN $threats)<-[r:DETECTED_THREAT]-(c:Cluster WHERE c.id =~ id_pattern)
          with threat, collect(r) as rels
          return threat {
            nodeid: id(threat),
            type: "threat",
            _rels: rels,
            title: threat.text,
            score: threat.score
          }
          `,
          { period, threats: input.threats },
        );

        const result2 = await session.run(
          `
          WITH $period + '-\\d+' AS id_pattern
          MATCH (hr:HierarchicalCluster)-[r:CONTAINS*..]->(c:Cluster)
          WHERE
            c.id =~ id_pattern AND
            EXISTS {
              (c)-[:DETECTED_THREAT]->(t:Threat WHERE t.text IN $threats)
            }
          WITH hr, collect(r) as rels, collect(c) as clusters
          RETURN hr {
            nodeid: id(hr),
            type: "hierarchicalcluster",
            .clusters,
            .id,
            .name,
            _rels: rels,
            _clusters: [(hr)-[:CONTAINS]->(cluster:Cluster WHERE cluster IN clusters) | cluster {
              nodeid: id(cluster),
              type: "cluster",
              answers: ${ans},
              countries: cluster.countries,
              id: cluster.id,
              keywords: cluster.keywords,
              labels: cluster.labels,
              locations: apoc.convert.fromJsonList(cluster.locations),
              name: cluster.name,
              nr_articles: cluster.nr_articles,
              state_date: cluster.start_date,
              representative_docs: cluster.representative_docs,
              summary: cluster.summary,
              title: cluster.title,
              topic_id: cluster.topic_id${
                input.everything
                  ? `,
              _articles: [(cluster)<-[r:IN_CLUSTER]-(article:Article) | article {
                nodeid: id(article),
                type: "article",
                _rels: r,
                _similar: [(article)-[r_sim:SIMILAR_TO]-(oa)-[:IN_CLUSTER]-(cluster) | r_sim],
                .id,
                outlier: article:Outlier,
                .prob_size,
                .title
              }]
              `
                  : ""
              }
            }]
          }
        `,
          { period, threats: input.threats },
        );
        t.measure("Neo4J query completed");
        t.payload([threats.records, result2.records], true);

        const rawGraph = createGraph();

        result2.records.forEach((record) => {
          const data = record.get("hr") as Neo4JTransferRecord;
          parseData(data, rawGraph, input.everything);
        });
        threats.records.forEach((record) => {
          const data = record.get("threat") as Neo4JTransferRecord;
          parseData(data, rawGraph, input.everything);
        });
        t.measure("Graph translation complete.");
        t.payload([rawGraph]);
        t.end();
        return rawGraph.get();
      } finally {
        await session.close();
      }
    }),
});
