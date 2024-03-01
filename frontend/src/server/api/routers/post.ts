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

  articles: publicProcedure.query(async () => {
    const session = driver.session();
    try {
      const result = await session.run(
        "MATCH (t:Topic)-[r]-(a:Article) return t,r,a limit 100",
      );
      return JSON.parse(JSON.stringify(result)) as Neo4JNodeData<
        Record<string, unknown>
      >;
    } finally {
      await session.close();
    }
    return null;
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
