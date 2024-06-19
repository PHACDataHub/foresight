import neo4j, {
  type Integer as Neo4jInteger,
  type QueryResult,
  type Relationship,
} from "neo4j-driver";
import { type RawEdge, type RawNode } from "@linkurious/ogma";
import { z } from "zod";

import { type User } from "next-auth";
import { env } from "~/env";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const debug = false;

const pixel = {
  article: { min: 2, max: 10 },
  cluster: { min: 10, max: 25 },
  hr: { min: 5, max: 15 },
  threat: { min: 5, max: 15 },
};

interface RawGraphInterface {
  nodes: RawNode[];
  edges: RawEdge[];
  edge_index: Record<string, boolean>;
  get: (opts?: { nodes?: RawNode<AllDataTypes>[]; edges?: RawEdge[] }) => {
    nodes: RawNode<AllDataTypes>[];
    edges: RawEdge[];
  };
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
  const nodes: RawNode<AllDataTypes>[] = [];
  const edges: RawEdge[] = [];
  const rawGraph: RawGraphInterface = {
    nodes,
    edges,
    edge_index: {},
    get: (opts) => ({
      nodes: nodes.concat(opts?.nodes ?? []),
      edges: edges.concat(opts?.edges ?? []),
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
  cb: (a: object) => object = (a) => a,
) => {
  const id = `${obj.nodeid.toNumber()}`;
  rawGraph.nodes.push({
    id,
    data: cb(convertNeo4jTypes(obj)),
  });
  addEdges(obj._rels, rawGraph);

  if (obj.type === "hierarchicalcluster") {
    obj._clusters.forEach((cluster) => {
      parseData(cluster, rawGraph, include_articles, cb);
    });
  } else if (obj.type === "cluster") {
    if (include_articles)
      obj._articles.forEach((articles) =>
        parseData(articles, rawGraph, include_articles, cb),
      );
    if ("_subclusters" in obj && Array.isArray(obj._subclusters)) {
      obj._subclusters.forEach((subclusters) =>
        parseData(
          subclusters as Neo4JTransferRecord,
          rawGraph,
          include_articles,
          cb,
        ),
      );
    }
  } else if (obj.type === "article") {
    addEdges(obj._similar, rawGraph);
  }
};

const funcTimer = (
  msg: string,
  params?: Record<
    string,
    string | string[] | number | null | undefined | boolean
  >,
) => {
  const width = 120;
  const start = new Date();
  let marked = start;

  const i = {
    measure: (title: string, mark?: boolean) => {
      if (!debug) return;
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
      console.log(
        `${label}${" ".repeat(Math.max(0, width - label.length - 1))}#`,
      );
      if (mark) marked = new Date();
    },
    msg: (title: string, mark?: boolean) => {
      if (!debug) return;
      const end = new Date();
      const prefix = `[${end.toLocaleTimeString()}]`;
      const label = `${prefix} ${title}`;
      console.log(
        `${label}${" ".repeat(Math.max(0, width - label.length - 1))}#`,
      );
      if (mark) marked = new Date();
    },
    payload: (data: unknown[], mark?: boolean) => {
      if (!debug) return;
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
      console.log(
        `${label}${" ".repeat(Math.max(0, width - label.length - 1))}#`,
      );
      if (mark) marked = new Date();
    },
    mark: () => {
      if (!debug) return;
      marked = new Date();
    },
    end: () => {
      if (!debug) return;
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
      console.log(
        `${label} ${"#".repeat(Math.max(0, width - label.length - 1))}`,
      );
    },
  };
  if (debug) {
    const prefix = `[${start.toLocaleTimeString()}]`;
    const label = `${prefix} ${msg}`;
    console.log(
      `${label} ${"#".repeat(Math.max(0, width - label.length - 1))}`,
    );
    if (params)
      JSON.stringify(params, null, 2)
        .split("\n")
        .forEach((m) => i.msg(m));
  }
  return i;
};

export const isUserRestricted = (user: User) => {
  const restricted_users = env.RESTRICTED_USERS?.split(",") || [];
  const username = ("username" in user && (user.username as string)) || "";
  return restricted_users.includes(username);
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
  radius: number;
}

export interface HierarchicalClusterRecord
  extends Omit<HierarchicalCluster, "clusters"> {
  clusters: Neo4JNumber[];
}

export interface Threat {
  type: "threat";
  title: string;
  score?: number;
  radius: number;
}

export interface Event {
  type: "event";
  title: string;
  id: string;
  age: number;
  persona: string;
  radius: number;
  nodes: {
    elementId: string;
    id: string | number;
    type: "article" | "cluster" | "article_outlier";
    title: string;
    persona: string;
    r_id: string;
  }[];
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
  radius: number;
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
  radius: number;
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
export type AllDataTypes =
  | Event
  | Threat
  | Cluster
  | HierarchicalCluster
  | Article;

export type AllDataTypeProperties =
  | "threat"
  | "event"
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
        if (neo4j.isDuration(value)) {
          return [key, value.seconds.toString()];
        }
        return [key, value];
      }),
  );
};

const driver = neo4j.driver(
  env.NEO4J_URL,
  neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD),
);

const driver_dfo = neo4j.driver(
  env.DFO_NEO4J_URL,
  neo4j.auth.basic(env.NEO4J_USERNAME, env.NEO4J_PASSWORD),
);

const getArticles = async (opts: {
  clusters: string[];
  user: User;
  persona?: string;
}) => {
  const session =
    opts.persona === "tom" ? driver_dfo.session() : driver.session();
  try {
    const t = funcTimer("getArticles", {
      clusters: opts.clusters,
      persona: opts.persona,
    });

    if (opts.persona === "tom") {
      const result = await session.run(
        `MATCH (c:Cluster)-[r]-(article:Article)
        RETURN article {
            nodeid: id(article),
            id: id(article),
            cluster_id: ID(c),
            type: "article",
            .keywords,
            .link,
            .pub_name,
            .summary,
            .title,
            _rels: r
          }`,
      );
      const rawGraph = createGraph();
      result.records.forEach((record) => {
        const data = record.get("article") as Neo4JTransferRecord;
        parseData(data, rawGraph, false);
      });
      t.measure("Graph translation complete.");
      t.end();
      return rawGraph.get();
    }

    if (isUserRestricted(opts.user)) throw new Error("403");

    const minmax = await session.run(
      `
    MATCH (c:Cluster)<-[r:IN_CLUSTER]-(article:Article)
    WHERE
      c.id IN $clusters
    RETURN log(min(article.prob_size)) as article_min, log(max(article.prob_size)) as article_max
    `,
      { clusters: opts.clusters },
    );

    const article_min = minmax.records.at(0)?.get("article_min") as number;
    const article_max = minmax.records.at(0)?.get("article_max") as number;

    const result2 = await session.run(
      `
    MATCH (c:Cluster)<-[r:IN_CLUSTER]-(article:Article)
    WHERE c.id IN $clusters
    RETURN article {
      nodeid: id(article),
      type: "article",
      cluster_id: c.id,
      _rels: r,
      _similar: [(article)-[r_sim:SIMILAR_TO]-(oa)-[:IN_CLUSTER]-(c) | r_sim],
      .id,
      outlier: article:Outlier,
      .prob_size,
      .pub_date,
      .title,
      radius: (
        ($max_pixel - $min_pixel) *
        (
          log(article.prob_size) - $article_min
        ) /
          ($article_max - $article_min)
      ) + $min_pixel,
      data__incomplete__: true
    }
  `,
      {
        clusters: opts.clusters,
        article_min,
        article_max,
        min_pixel: pixel.article.min,
        max_pixel: pixel.article.max,
      },
    );
    t.measure("Neo4J query completed", true);

    const rawGraph = createGraph();
    result2.records.forEach((record) => {
      const data = record.get("article") as Neo4JTransferRecord;
      parseData(data, rawGraph, false);
    });
    t.measure("Graph translation complete.");
    t.end();
    return rawGraph.get();
  } finally {
    await session.close();
  }
};

export const postRouter = createTRPCRouter({
  personas: protectedProcedure.query(async ({ ctx }) => {
    const result = await ctx.db.persona.findMany({
      where: isUserRestricted(ctx.session.user) ? { id: "tom" } : undefined,
    });
    return result;
  }),

  updateUserPersona: protectedProcedure
    .input(z.object({ persona: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.user.update({
        where: { id: ctx.session.user.id },
        data: { persona: input.persona },
      });
    }),

  nodesWithKeywordTerms: protectedProcedure
    .input(
      z.object({
        terms: z.array(z.string()),
        and: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      if (input.terms.length === 0) return [];

      const session = driver_dfo.session();

      try {
        const t = funcTimer("nodesWithKeywordTerms", input);
        const comp = input.and ? "all" : "any";

        const result = await session.run(
          `
        MATCH (c:Cluster)
          WHERE 
            ${comp}(term in $terms WHERE term IN c.keywords)
            OR EXISTS {
              MATCH (c)<-[]-(a:Article)
                WHERE ${comp}(term IN $terms WHERE term IN a.keywords)
            }
        return id(c) as id
        UNION
        MATCH (a:Article)
          WHERE
            ${comp}(term IN $terms WHERE term IN a.keywords)
        return id(a) as id
        `,
          { terms: input.terms },
        );
        t.measure("Neo4J query completed", true);
        const ret = result.records.map((record) => {
          const id = record.get("id") as string;
          return `${id}`;
        });
        t.measure("Mapping complete.");
        t.end();
        return ret;
      } finally {
        await session.close();
      }
    }),

  nodesWithTerms: protectedProcedure
    .input(
      z.object({
        terms: z.array(z.string()),
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
        everything: z.boolean().optional(),
        threats: z.array(z.string()),
        and: z.boolean().optional(),
        persona: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      if (input.terms.length === 0) return [];

      const session =
        input.persona === "tom" ? driver_dfo.session() : driver.session();

      try {
        const t = funcTimer("nodesWithTerms", input);
        const comp = input.and ? "all" : "any";

        if (input.persona === "tom") {
          const result = await session.run(
            `
          MATCH (c:Cluster)
            WHERE 
              ${comp}(term in $terms WHERE toLower(c.label) CONTAINS term OR toLower(c.summary) CONTAINS term)
              OR EXISTS {
                MATCH (c)<-[]-(a:Article)
                  WHERE ${comp}(term IN $terms WHERE toLower(a.title) CONTAINS term OR toLower(a.summary) CONTAINS term)
              }
          return id(c) as id
          UNION
          MATCH (a:Article)
            WHERE
              ${comp}(term IN $terms WHERE toLower(a.title) CONTAINS term OR toLower(a.summary) CONTAINS term)
          return id(a) as id
          `,
            { terms: input.terms },
          );
          t.measure("Neo4J query completed", true);
          const ret = result.records.map((record) => {
            const id = record.get("id") as string;
            return `${id}`;
          });
          t.measure("Mapping complete.");
          t.end();
          return ret;
        }
        if (isUserRestricted(ctx.session.user)) throw new Error("403");
        const period = getPeriod({ day: input.day, history: input.history });
        const result = await session.run(
          `
        WITH $period + '-\\d+' AS id_pattern
        MATCH (c:Cluster)-[:DETECTED_THREAT]->(t:Threat)
          WHERE 
            (c.id =~ id_pattern AND t.text IN $threats) AND (
              ${comp}(term in $terms WHERE toLower(c.title) CONTAINS term OR toLower(c.summary) CONTAINS term)
              OR EXISTS {
                MATCH (c)<-[:IN_CLUSTER]-(a:Article)
                  WHERE ${comp}(term IN $terms WHERE toLower(a.title) CONTAINS term OR toLower(a.content) CONTAINS term)
              }
            )
        return c.id as id
        UNION
        WITH $period + '-\\d+' AS id_pattern
        MATCH (a:Article)-[:IN_CLUSTER]->(c:Cluster)-[r:DETECTED_THREAT]->(t:Threat)
          WHERE
            c.id =~ id_pattern AND t.text IN $threats AND (
              ${comp}(term IN $terms WHERE toLower(a.title) CONTAINS term OR toLower(a.content) CONTAINS term)
            )
        return a.id as id
        `,
          { terms: input.terms, period, threats: input.threats },
        );
        t.measure("Neo4J query completed", true);
        const ret = result.records.map((record) => {
          const id = record.get("id") as string;
          return `${id}`;
        });
        t.measure("Mapping complete.");
        t.end();
        return ret;
      } finally {
        await session.close();
      }
    }),

  threats: protectedProcedure
    .input(z.object({ persona: z.string() }))
    .query(async ({ input, ctx }) => {
      const session =
        input.persona === "tom" ? driver_dfo.session() : driver.session();
      try {
        if (input.persona === "tom") {
          const result = await session.run(
            `MATCH (t:Cluster) WHERE NOT t.id CONTAINS "-"  return t ORDER BY size(t.all_label) DESC;`,
          );
          return result.records
            .map((record) => {
              const t = record.get("t") as {
                properties: { label: string; all_label: string[] };
              };
              return {
                text: t.properties.label,
                score: t.properties.all_label.length ?? 0,
              };
            })
            .sort((a, b) => {
              if (a.score > b.score) return -1;
              if (a.score < b.score) return 1;
              return 0;
            });
        }
        if (isUserRestricted(ctx.session.user)) throw new Error("403");
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

  listEvents: protectedProcedure.query(async () => {
    const session = driver.session();
    try {
      const t = funcTimer("listEvents");
      const events = await session.run(`
        MATCH (event:Event)
        return event {
          nodeid: id(event),
          type: "event",
          radius: 1,
          age: duration.between(event.created, datetime()),
          .id,
          .persona,
          .title,
          nodes: [(event)-[r:LINKED_TO]->(n) | n {
              nodeid: id(n),
              .id,
              type: CASE n:Article WHEN True THEN
                CASE n:Outlier WHEN TRUE THEN "article_outlier" ELSE "article" END
                ELSE "cluster" END,
              persona: r.persona,
              .title,
              r_id: elementId(r)
          }]
        }
      `);
      t.measure("Neo4J query completed", true);
      const rawGraph = createGraph();
      events.records.forEach((record) => {
        const data = record.get("event") as Neo4JTransferRecord;
        parseData(data, rawGraph, false, (n) => {
          if ("nodes" in n && Array.isArray(n.nodes)) {
            return {
              ...n,
              nodes: n.nodes.map((c: Neo4JTransferRecord) =>
                convertNeo4jTypes(c),
              ),
            };
          }
          return n;
        });
      });
      t.measure("Graph translation complete.");
      t.end();
      return rawGraph;
    } finally {
      await session.close();
    }
  }),

  addToEvent: protectedProcedure
    .input(
      z.object({
        event_id: z.string(),
        persona: z.string(),
        nodes: z.array(
          z.object({
            type: z.enum(["article", "cluster"]),
            id: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const session = driver.session();
      try {
        const first = input.nodes.at(0);
        if (!first)
          throw new Error("Unable to create event, invalid first node.");

        for (const n of input.nodes) {
          await session.run(
            `
          MATCH (n:${n.type === "article" ? "Article" : "Cluster"} {id: $id}), (event:Event {id: $event_id}) CREATE (event)-[:LINKED_TO { persona: $persona }]->(n);
        `,
            {
              event_id: input.event_id,
              id: first.type === "article" ? Number(n.id) : n.id,
              persona: input.persona,
            },
          );
        }
        return true;
      } finally {
        await session.close();
      }
    }),
  createEvent: protectedProcedure
    .input(
      z.object({
        persona: z.string(),
        nodes: z.array(
          z.object({
            type: z.enum(["article", "cluster"]),
            id: z.string(),
          }),
        ),
      }),
    )
    .mutation(async ({ input }) => {
      const session = driver.session();
      try {
        const first = input.nodes.at(0);
        if (!first)
          throw new Error("Unable to create event, invalid first node.");
        const firstNode = await session.run(
          `
          MATCH (n { id: $id }) WHERE $nodeType IN labels(n) return n;
        `,
          {
            id: first.type === "article" ? Number(first.id) : first.id,
            nodeType: first.type === "article" ? "Article" : "Cluster",
          },
        );
        const ret = firstNode.records.at(0);
        if (!ret) {
          throw new Error(
            "Unable to create event, unable to locate first node.",
          );
        }
        const title = (ret.get("n") as { properties: { title: string } })
          .properties.title;

        const evtNode = await session.run(
          `
        CREATE (event:Event {
          id: $id + "_" + toString(datetime()),
          title: $title,
          persona: $persona,
          created: datetime()
        }) return event;
        `,
          {
            id: first.type === "article" ? Number(first.id) : first.id,
            title,
            persona: input.persona,
          },
        );
        const evt = evtNode.records.at(0);
        if (!evt) throw new Error("An error occurred created the event.");
        const event_id = (evt.get("event") as { properties: { id: string } })
          .properties.id;
        for (const n of input.nodes) {
          await session.run(
            `
            MATCH (n:${n.type === "article" ? "Article" : "Cluster"} {id: $id}), (event:Event {id: $event_id}) CREATE (event)-[:LINKED_TO { persona: $persona }]->(n);
          `,
            {
              event_id,
              id: first.type === "article" ? Number(n.id) : n.id,
              persona: input.persona,
            },
          );
        }
        return event_id;
      } finally {
        await session.close();
      }
    }),

  deleteEvent: protectedProcedure
    .input(
      z.object({
        event_id: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const session = driver.session();
      try {
        await session.run(
          `
          MATCH (event:Event { id: $event_id }) DETACH DELETE event;
          `,
          {
            event_id: input.event_id,
          },
        );
        return true;
      } finally {
        await session.close();
      }
    }),

  unlinkNodeFromEvent: protectedProcedure
    .input(
      z.object({
        event_id: z.string(),
        node_id: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const session = driver.session();
      try {
        console.log(input);
        await session.run(
          `
          MATCH (event:Event { id: $event_id })-[r:LINKED_TO]->()
            WHERE elementId(r) = $node_id 
          DELETE r;
          `,
          {
            event_id: input.event_id,
            node_id: input.node_id,
          },
        );
        return true;
      } finally {
        await session.close();
      }
    }),
  feedback: protectedProcedure
    .input(z.object({ email: z.string().optional(), feedback: z.string() }))
    .mutation(async ({ input }) => {
      const session = driver.session();
      console.log({
        email: input.email,
        feedback: input.feedback,
        created: new Date(),
      });
      try {
        const r = await session.run(
          `
        CREATE (feedback:ProductFeedback {
          email: $email,
          feedback: $feedback,
          created: datetime()
        })
        `,
          { email: input.email, feedback: input.feedback },
        );
        if (r) return true;
      } finally {
        await session.close();
      }
      return false;
    }),

  cluster: protectedProcedure
    .input(z.object({ id: z.string(), persona: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const session =
        input.persona === "tom" ? driver_dfo.session() : driver.session();
      try {
        const t = funcTimer("cluster", input);

        if (input.persona === "tom") {
          const data = await session.run(
            `
            MATCH (cluster:Cluster) WHERE ID(cluster) = $id RETURN cluster {
              type: "cluster",
              nodeid: id(cluster),
              id: id(cluster),
              .label,
              .name,
              .summary,
              .all_label,
              .keywords,
              .rep_keywords,
              .kbi_keywords,
              .mmr_keywords,
              _rels: [(cluster)-[r]-(c:Cluster) | r],
              _subclusters: [(cluster)<-[r]-(c:Cluster) | c {
                type: "cluster",
                nodeid: id(c),
                id: id(c),
                _articles: [],
                .label,
                .name,
                .summary,
                .all_label,
                .keywords,
                .rep_keywords,
                .kbi_keywords,
                .mmr_keywords,
                _rels: r                
              }],
              _articles: [(cluster)-[r]-(article:Article) | article {
                id: id(article),
                nodeid: id(article),
                type: "article",
                .keywords,
                .link,
                .pub_name,
                .summary,
                .title,
                _rels: r
              } ]
            } `,
            { id: parseInt(input.id) },
          );

          const rawGraph = createGraph();
          data.records.forEach((record) => {
            const data = record.get("cluster") as Neo4JTransferRecord;
            parseData(data, rawGraph, true);
          });
          t.measure("Graph translation complete.");
          t.end();
          return rawGraph.get();
        }
        if (isUserRestricted(ctx.session.user)) throw new Error("403");

        const minmax = await session.run(
          `
        MATCH (c:Cluster {id: $id})<-[r:IN_CLUSTER]-(article:Article)
        RETURN
          log(min(article.prob_size)) as article_min,
          log(max(article.prob_size)) as article_max
        `,
          { id: input.id },
        );

        const article_min = minmax.records.at(0)?.get("article_min") as number;
        const article_max = minmax.records.at(0)?.get("article_max") as number;

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
              radius: (
                ($max_pixel - $min_pixel) *
                (
                  log(article.prob_size) - $article_min
                ) /
                  ($article_max - $article_min)
              ) + $min_pixel,
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
          {
            id: input.id,
            article_min,
            article_max,
            min_pixel: pixel.article.min,
            max_pixel: pixel.article.max,
          },
        );
        t.measure("Neo4J query completed", true);
        const rawGraph = createGraph();
        result.records.forEach((record) => {
          const data = record.get("cluster") as Neo4JTransferRecord;
          parseData(data, rawGraph, true);
        });
        t.measure("Graph translation complete.");
        t.end();
        return rawGraph;
      } finally {
        await session.close();
      }
    }),

  getArticle: protectedProcedure
    .input(
      z.object({
        article_id: z.number(),
        cluster_id: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const session = driver.session();
      try {
        const t = funcTimer("getArticle", input);
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
        t.measure("Neo4J query completed", true);

        const rawGraph = createGraph();
        result2.records.forEach((record) => {
          const data = record.get("article") as Neo4JTransferRecord;
          parseData(data, rawGraph, false);
        });
        t.measure("Graph translation complete.");
        t.end();
        return rawGraph.get();
      } finally {
        await session.close();
      }
    }),

  getArticles: protectedProcedure
    .input(
      z.object({
        clusters: z.array(z.string()),
        persona: z.string(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      return await getArticles({
        clusters: input.clusters,
        user: ctx.session.user,
        persona: input.persona,
      });
    }),

  question: protectedProcedure
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

  hierarchicalClustersArticleCount: protectedProcedure
    .input(
      z.object({
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
        everything: z.boolean().optional(),
        threats: z.array(z.string()),
        persona: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const session =
        input.persona === "tom" ? driver_dfo.session() : driver.session();
      const period = getPeriod({ day: input.day, history: input.history });

      try {
        if (input.persona === "tom") {
          const counter = await session.run(
            `
            MATCH (cluster:Cluster)-[]-(article: Article)
              // WHERE
              //   cluster.label IN $threats OR
              //   EXISTS {
              //     (cluster)<-[r*3]-(b:Cluster) WHERE b.label IN $threats
              //   }
            RETURN
              COUNT(article) as count`,
            { threats: input.threats },
          );
          for (const r of counter.records) {
            const count = r.get("count") as Neo4jInteger;
            return count.toNumber();
          }
          return 0;
        }
        if (isUserRestricted(ctx.session.user)) throw new Error("403");
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
  hierarchicalClusters: protectedProcedure
    .input(
      z.object({
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
        everything: z.boolean().optional(),
        threats: z.array(z.string()),
        include_articles: z.boolean().default(true),
        persona: z.string(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const session =
        input.persona === "tom" ? driver_dfo.session() : driver.session();
      const period = getPeriod({ day: input.day, history: input.history });

      try {
        const t = funcTimer("hierarchicalClusters", input);
        if (input.persona === "tom") {
          const data = await session.run(
            `
              MATCH (cluster:Cluster)
              // WHERE
              //   cluster.label IN $threats OR
              //   EXISTS {
              //     (cluster)<-[r*3]-(b:Cluster) WHERE b.label IN $threats
              //   }
              RETURN cluster {
                type: "cluster",
                nodeid: id(cluster),
                id: id(cluster),
                .label,
                .name,
                .summary,
                .all_label,
                .keywords,
                .rep_keywords,
                .kbi_keywords,
                .mmr_keywords,
                _rels: [
                  (cluster)-[r]-(c:Cluster)
                  // WHERE  
                  //   c.label IN $threats OR
                  //   EXISTS {
                  //     (c)<-[*3]-(b:Cluster) WHERE b.label IN $threats
                  //   }
                  | r],
                _articles: [(cluster)-[r]-(article:Article) | article {
                  nodeid: id(article),
                  id: id(article),
                  type: "article",
                  .keywords,
                  .link,
                  .pub_name,
                  .summary,
                  .title,
                  _rels: r
                } ]
              } `,
            { threats: input.threats },
          );

          const rawGraph = createGraph();
          data.records.forEach((record) => {
            const data = record.get("cluster") as Neo4JTransferRecord;
            parseData(data, rawGraph, input.include_articles);
          });
          t.measure("Graph translation complete.");
          t.end();
          return rawGraph.get();
        }
        if (isUserRestricted(ctx.session.user)) throw new Error("403");

        const threats = await session.run(
          `
          WITH $period + '-\\d+' AS id_pattern
          MATCH (threat:Threat WHERE threat.text IN $threats)<-[r:DETECTED_THREAT]-(c:Cluster WHERE c.id =~ id_pattern)
          WITH collect(threat) as threats, collect(r) as rels, log(MIN(threat.score)) as min, log(MAX(threat.score)) as max
          UNWIND threats as threat
          return threat {
            nodeid: id(threat),
            type: "threat",
            _rels: rels,
            title: threat.text,
            score: threat.score,
            radius: CASE threat.score IS NOT NULL 
              WHEN True THEN 
                (
                  ($max_pixel - $min_pixel) *
                  (log(threat.score) - min) / (max - min)
                ) + $min_pixel
              ELSE
                $min_pixel
              END
          }
          `,
          {
            period,
            threats: input.threats,
            max_pixel: pixel.threat.max,
            min_pixel: pixel.threat.min,
          },
        );

        const minmax = await session.run(
          `
          WITH $period + '-\\d+' AS id_pattern
          MATCH (hr:HierarchicalCluster)-[r:CONTAINS*..]->(c:Cluster)
          WHERE
            c.id =~ id_pattern AND
            EXISTS {
              (c)-[:DETECTED_THREAT]->(t:Threat WHERE t.text IN $threats)
            }
          return
            log(MIN(c.nr_articles)) as cluster_min,
            log(MAX(c.nr_articles)) as cluster_max,
            log(MIN(SIZE(hr.clusters))) as hr_min,
            log(MAX(SIZE(hr.clusters))) as hr_max
        `,
          { period, threats: input.threats },
        );

        const cluster_min = minmax.records.at(0)?.get("cluster_min") as number;
        const cluster_max = minmax.records.at(0)?.get("cluster_max") as number;
        const hr_min = minmax.records.at(0)?.get("hr_min") as number;
        const hr_max = minmax.records.at(0)?.get("hr_max") as number;

        const stddev_query = await session.run(
          `
        WITH $period + '-\\d+' AS id_pattern          
        MATCH (c:Cluster)<-[r:IN_CLUSTER]-(article:Article)
        WHERE
          c.id =~ id_pattern AND
          EXISTS {
            (c)-[:DETECTED_THREAT]->(t:Threat WHERE t.text IN $threats)
          }
        WITH c.id as id, article.pub_date as d, count(*) as counts
          RETURN id, stDev(counts) as std;    
        `,
          { period, threats: input.threats },
        );
        let stddev_min: number | null = null;
        let stddev_max: number | null = null;
        const stddev = Object.fromEntries(
          stddev_query.records.map((r) => {
            stddev_min =
              typeof stddev_min !== "number"
                ? (r.get("std") as number)
                : Math.min(stddev_min, r.get("std") as number);
            stddev_max =
              typeof stddev_max !== "number"
                ? (r.get("std") as number)
                : Math.max(stddev_max, r.get("std") as number);
            return [r.get("id") as string, r.get("std") as number];
          }),
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
          WITH
            hr,
            collect(r) as rels,
            collect(c) as clusters
          RETURN hr {
            nodeid: id(hr),
            type: "hierarchicalcluster",
            .clusters,
            .id,
            .name,
            radius: (
              ($max_hr_pixel - $min_hr_pixel) *
              (
                log(SIZE(hr.clusters)) - $hr_min
              ) /
                ($hr_max - $hr_min)
            ) + $min_hr_pixel,
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
              radius: (
                  ($max_pixel - $min_pixel) *
                  (
                    log(cluster.nr_articles) - $cluster_min
                  ) /
                    ($cluster_max - $cluster_min)
                ) + $min_pixel,
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
          {
            period,
            threats: input.threats,
            max_pixel: pixel.cluster.max,
            min_pixel: pixel.cluster.min,
            max_hr_pixel: pixel.hr.max,
            min_hr_pixel: pixel.hr.min,
            cluster_min,
            cluster_max,
            hr_min,
            hr_max,
          },
        );
        t.measure("Neo4J query completed", true);

        const rawGraph = createGraph();

        const clusters: string[] = [];
        result2.records.forEach((record) => {
          const data = record.get("hr") as Neo4JTransferRecord;
          if (data.type === "hierarchicalcluster") {
            clusters.push(...data._clusters.map((c) => c.id as string));
          }
          parseData(data, rawGraph, input.everything, (o) => {
            if ("type" in o && o.type === "cluster" && "id" in o) {
              const cluster_id = o.id as string;
              const stdev = stddev[cluster_id]!;
              if (stdev) {
                return { ...o, stdev, stddev_min, stddev_max };
              }
            }
            return o;
          });
        });

        threats.records.forEach((record) => {
          const data = record.get("threat") as Neo4JTransferRecord;
          parseData(data, rawGraph, input.everything);
        });

        t.measure("Graph translation complete.");
        t.end();
        if (!input.include_articles) return rawGraph.get();
        const articles = await getArticles({
          clusters,
          user: ctx.session.user,
        });
        return rawGraph.get(articles);
      } finally {
        await session.close();
      }
    }),
});
