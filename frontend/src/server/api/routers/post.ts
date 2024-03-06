import { type Neo4JNodeData } from "@linkurious/ogma";
import neo4j from "neo4j-driver";
import { z } from "zod";
import { env } from "~/env";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

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
      z.object({ day: z.number().gte(1).lte(62)
        // , threats: z.string().array() 
      }),
    )
    .query(async ({ input }) => {
      const session = driver.session();
      const baseDate = new Date("2019-12-01");
      baseDate.setDate(baseDate.getDate() + input.day - 1);
      const startDate = baseDate.toLocaleDateString("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      });

      const period = `${startDate}`;
      try {
        const result = await session.run(
          `
        WITH $period + '-\\d+' AS id_pattern
          MATCH (c:Cluster)-[r:DETECTED_THREAT]->(t:Threat)
            WHERE c.id =~ id_pattern
        RETURN c, r, t
        `,
          { period }
          // , threats: input.threats },
        );
        // AND t.text IN $threats
        return JSON.parse(JSON.stringify(result)) as Neo4JNodeData<
          Record<string, unknown>
        >;
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
