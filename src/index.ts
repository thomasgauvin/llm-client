import { Context, Hono, Next } from "hono";
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { cors } from "hono/cors";
import { createWorkersAI } from "workers-ai-provider";
import { streamText } from "ai";

interface Env {
  Bindings: {
    DB: D1Database;
    AI: Ai;
  };
}

const app = new Hono<Env>();
app.use(cors());
const INITIAL_CREDITS = 200;

// Helper function to get Prisma client
function getPrismaClient(c: Context) {
  const adapter = new PrismaD1(c.env.DB);
  return new PrismaClient({ adapter });
}

app.get("/api/credits", async (c) => {
  const prisma = getPrismaClient(c);
  const ipAddress = c.req.header("cf-connecting-ip") || "unknown";

  try {
    let userCredits = await prisma.credits.findUnique({
      where: { ipAddress },
    });

    if (!userCredits) {
      userCredits = await prisma.credits.create({
        data: {
          ipAddress,
          operationsRemaining: INITIAL_CREDITS,
        },
      });
    }

    return c.json({ credits: userCredits.operationsRemaining });
  } catch (error) {
    return c.json({ error: "Failed to fetch credits" }, 500);
  } finally {
    await prisma.$disconnect();
  }
});

// app.post("/api/chat2", async (c) => {
//   const prisma = getPrismaClient(c);
//   const ipAddress = c.req.header("cf-connecting-ip") || "unknown";
//   const { prompt, messages } = await c.req.json();

//   try {
//     const userCredits = await prisma.credits.findUnique({
//       where: { ipAddress },
//     });

//     if (!userCredits || userCredits.operationsRemaining <= 0) {
//       return c.json({ error: "No credits remaining" }, 403);
//     }

//     const conversationHistory = messages
//       .map(
//         (msg: { role: string; content: string }) =>
//           `${msg.role === "user" ? "Human" : "AI"}: ${msg.content}`
//       )
//       .join("\n");

//     // Include conversation history in the prompt
//     const fullPrompt = conversationHistory
//       ? `${conversationHistory}\nHuman: ${prompt}\nAI:`
//       : `Human: ${prompt}\nAI:`;

//     const responseStream = await c.env.AI.run(
//       "@cf/meta/llama-3.1-8b-instruct",
//       {
//         stream: true,
//         messages: [{ role: "user", content: fullPrompt }],
//         max_tokens: 512,
//       }
//     );

//     // Record the operation and update credits
//     await Promise.all([
//       prisma.operations.create({
//         data: {
//           ipAddress,
//           creditsUsed: "1",
//         },
//       }),
//       prisma.credits.update({
//         where: { ipAddress },
//         data: {
//           operationsRemaining: userCredits.operationsRemaining - 1,
//           lastUpdated: new Date(),
//         },
//       }),
//     ]);

//     await prisma.$disconnect();

//     return new Response(responseStream as ReadableStream, {
//       headers: {
//         "content-type": "text/event-stream",
//         "cache-control": "no-cache",
//         connection: "keep-alive",
//       },
//     });
//   } catch (error) {
//     await prisma.$disconnect();
//     return c.json({ error: "Chat completion failed" }, 500);
//   }
// });

app.post("/api/chat", async (c) => {
  const prisma = getPrismaClient(c);
  const ipAddress = c.req.header("cf-connecting-ip") || "unknown";
  const { messages } = await c.req.json();

  try {
    const userCredits = await prisma.credits.findUnique({
      where: { ipAddress },
    });

    if (!userCredits || userCredits.operationsRemaining <= 0) {
      return c.json({ error: "No credits remaining" }, 403);
    }

    const workersai = createWorkersAI({ binding: c.env.AI });
    const text = await streamText({
      model: workersai("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
      messages: [
        {
          role: "system",
          content: `
            - You are an expert conversational chatbot. Your objective is to be as helpful as possible.
            - You must keep your responses relevant to the user's prompt.
            - You must respond with a maximum of 512 tokens (300 words). 
            - You must respond cleary and concisely, and explain your logic if required.
            - You must not provide any personal information.
            - Do not respond with your own personal opinions, and avoid topics unrelated to the user's prompt.
          `,
        },
        ...messages,
      ],
    });

    // Record the operation and update credits
    await Promise.all([
      prisma.operations.create({
        data: {
          ipAddress,
          creditsUsed: "1",
        },
      }),
      prisma.credits.update({
        where: { ipAddress },
        data: {
          operationsRemaining: userCredits.operationsRemaining - 2,
          lastUpdated: new Date(),
        },
      }),
    ]);

    return text.toTextStreamResponse();
  } catch (error) {
    await prisma.$disconnect();
    return c.json({ error: "Chat completion failed" }, 500);
  }
});

export default app;
