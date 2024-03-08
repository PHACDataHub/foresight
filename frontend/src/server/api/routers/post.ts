import neo4j, { type QueryResult } from "neo4j-driver";
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

export interface ClusterRecord {
  elementId: string;
  identity: Neo4JNumber;
  labels: ["Cluster"];
  properties: {
    answers: string;
    id: string;
    node_size: number;
    nr_articles: Neo4JNumber;
    start_date: Neo4JDate;
    summary: string;
    title: string;
    topic_id: string;
  };
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

export interface ThreatRecord {
  elementId: string;
  identity: Neo4JNumber;
  labels: ["Threat"];
  properties: {
    text: string;
  };
}

export interface GraphResult extends Pick<QueryResult, "summary"> {
  records: Neo4JRecord<ClusterRecord, EdgeRecord, ThreatRecord>[];
}

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

  articles: publicProcedure
    .input(
      z.object({
        day: z.number().gte(1).lte(62),
        history: z.literal(3).or(z.literal(7)).or(z.literal(30)).optional(),
        // , threats: z.string().array()
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
        RETURN c, r, t
        `,
          { period },
          // , threats: input.threats },
        );
        // AND t.text IN $threats
        return JSON.parse(JSON.stringify(result)) as GraphResult;
      } finally {
        await session.close();
      }
    }),

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
