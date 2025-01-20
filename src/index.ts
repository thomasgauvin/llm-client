import { Context, Hono, Next } from 'hono';
import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import { cors } from 'hono/cors';
import { createWorkersAI } from 'workers-ai-provider';
import { streamText } from 'ai';
import jwt from '@tsndr/cloudflare-worker-jwt';

interface Env {
	Bindings: {
		DB: D1Database;
		AI: Ai;
	};
}

const WORKER_SECRET_KEY = 'xN4DU7Jj0MGTSA3zVAzJHQ6wFmbolZz+eLLeJhqwKCc=';
const TURNSTILE_SECRET_KEY = '0x4AAAAAAA5tow-gD0lnobS8MyF9eWWsim8';

const app = new Hono<Env>();
app.use(cors());
const INITIAL_CREDITS = 200;

// Helper function to get Prisma client
function getPrismaClient(c: Context) {
	const adapter = new PrismaD1(c.env.DB);
	return new PrismaClient({ adapter });
}

app.post('/api/token', async (c) => {
	const ipAddress = c.req.header('cf-connecting-ip') || 'unknown';
	const { token } = await c.req.json();

	const isVerifiedTurnstile = await verifyTurnstile(token, ipAddress);

	if (!isVerifiedTurnstile) {
		return c.json({ error: 'Failed to verify token' }, 403);
	}

	const workersToken = await generateWorkerToken(token, ipAddress);
	return c.json({ workersToken });
});

app.post('/api/credits', async (c) => {
	const prisma = getPrismaClient(c);
	const ipAddress = c.req.header('cf-connecting-ip') || 'unknown';
	const { token } = await c.req.json();

	const isVerifiedWorker = await verifyWorkerToken(token, ipAddress);
	let isVerifiedTurnstile = false;
	if (!isVerifiedWorker) {
		isVerifiedTurnstile = await verifyTurnstile(token, ipAddress);
	}

	if (!isVerifiedWorker && !isVerifiedTurnstile) {
		return c.json({ error: 'Failed to verify token' }, 403);
	}

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
		return c.json({ error: 'Failed to fetch credits' }, 500);
	} finally {
		await prisma.$disconnect();
	}
});

app.post('/api/chat', async (c) => {
	const prisma = getPrismaClient(c);
	const ipAddress = c.req.header('cf-connecting-ip') || 'unknown';
	const { messages, token } = await c.req.json();

	const isVerifiedWorker = await verifyWorkerToken(token, ipAddress);
	const isVerifiedTurnstile = await verifyTurnstile(token, ipAddress);

	if (!isVerifiedWorker && !isVerifiedTurnstile) {
		return c.json({ error: 'Failed to verify token' }, 403);
	}

	try {
		const userCredits = await prisma.credits.findUnique({
			where: { ipAddress },
		});

		if (!userCredits || userCredits.operationsRemaining <= 0) {
			return c.json({ error: 'No credits remaining' }, 403);
		}

		const workersai = createWorkersAI({ binding: c.env.AI });
		const text = await streamText({
			model: workersai('@cf/meta/llama-3.3-70b-instruct-fp8-fast'),
			messages: [
				{
					role: 'system',
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
					creditsUsed: '1',
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
		return c.json({ error: 'Chat completion failed' }, 500);
	}
});

async function verifyWorkerToken(token: string, ip: string) {
	console.log('verifying worker token');

	let verifiedToken;
	try {
		verifiedToken = await jwt.verify(token, WORKER_SECRET_KEY);
	} catch (err) {
		//do nothing, we might have a turnstile token which will be verified by the turnstile that follows
	}

	console.log('verified token is ', !!verifiedToken);

	return !!verifiedToken;
}

async function generateWorkerToken(turnstileToken: string, ip: string) {
	console.log('generating worker token');
	const token = await jwt.sign({ ip, turnstileToken }, WORKER_SECRET_KEY);
	return token;
}

async function verifyTurnstile(token: string, ip: string) {
	// Validate the token by calling the
	// "/siteverify" API endpoint.
	let formData = new FormData();
	formData.append('secret', TURNSTILE_SECRET_KEY);
	formData.append('response', token);
	formData.append('remoteip', ip);

	console.log('verifying token with siteverify');

	const url = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
	const result = await fetch(url, {
		body: formData,
		method: 'POST',
	});

	const outcome: {
		success: boolean;
	} = await result.json();

	console.log('siteverify token is ', outcome.success);

	return outcome.success;
}

export default app;
