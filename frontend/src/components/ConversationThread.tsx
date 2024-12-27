import React, { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Pause } from 'lucide-react';
import { storeName } from '../consts';
import { AiConfiguration } from './ChatApp';

interface Message {
	text: string;
	isUser: boolean;
}

interface Conversation {
	id?: number;
	title: string;
	messages: Message[];
}

interface ConversationThreadProps {
	ollamaApiBaseUrl: string;
	ollamaApiUrl: string;
	conversations: Conversation[];
	conversationId: number | null;
	setConversationId: (id: number) => void;
	conversationTitle: string;
	setConversationTitle: (title: string) => void;
	setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
	db: any;
	aiConfiguration: AiConfiguration | undefined;
}

const ConversationThread: React.FC<ConversationThreadProps> = ({
	ollamaApiUrl,
	conversations,
	conversationId,
	setConversationId,
	conversationTitle,
	setConversationTitle,
	setConversations,
	db,
	aiConfiguration,
}) => {
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState<string>('');
	const [controller, setController] = useState<AbortController>(new AbortController());
	const [isLoading, setIsLoading] = useState<boolean>(false);
	const [streamStarted, setStreamStarted] = useState<boolean>(false);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(scrollToBottom, [messages]);

	useEffect(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
		}
	}, [input]);

	//when the conversation id changes, load the messages for the conversation
	useEffect(() => {
		const loadConversation = async () => {
			if (!conversationId) {
				setMessages([]);
				setConversationTitle('New conversation');
				return;
			}
			if (conversationId) {
				const conversation = await db.get(storeName, conversationId);
				setConversationTitle(conversation.title);
				setMessages(conversation.messages);
			}
		};
		loadConversation();
	}, [conversationId]);

	const streamResponse = async (prompt: string, conversationHistory: string) => {
		let aiResponse = '';

		if (!aiConfiguration || !aiConfiguration.config || !aiConfiguration.config?.model) {
			alert('Please select an AI model');
			return;
		}

		try {
			const fullPrompt = conversationHistory + '\nHuman: ' + prompt + '\nAI:';
			const response = await fetch(ollamaApiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: aiConfiguration.config.model,
					prompt: fullPrompt,
					stream: true,
				}),
				signal: controller.signal,
			});

			if (!response.ok) {
				throw new Error('Network response was not ok');
			}

			const reader = response.body!.getReader();
			const decoder = new TextDecoder();

			setMessages((prev) => [...prev, { text: '', isUser: false }]);
			setStreamStarted(true);

			while (true) {
				console.log('streaming');
				console.log(JSON.stringify(controller.signal.aborted));
				const { done, value } = await reader.read();
				if (done) break;

				if (controller.signal.aborted) {
					break;
				}
				const chunk = decoder.decode(value);
				const lines = chunk.split('\n');
				lines.forEach((line) => {
					if (line.trim() !== '') {
						try {
							const parsed = JSON.parse(line);
							aiResponse += parsed.response;
							setMessages((prev) => {
								const newMessages = [...prev];
								newMessages[newMessages.length - 1].text = aiResponse;
								return newMessages;
							});
						} catch (e) {
							console.error('Error parsing JSON:', e);
						}
					}
				});
			}
		} catch (error) {
			if (controller.signal.aborted) {
				console.log('Stream aborted');
			} else {
				console.error('Error generating response:', error);
				setMessages((prev) => [
					...prev,
					{
						text: "Sorry, I couldn't generate a response. Please try again. Ensure you're properly running Ollama. If you've overridden the Ollama address, ensure it is properly configured and accessible.",
						isUser: false,
					},
				]);
			}
		} finally {
			setStreamStarted(false);
			setController(new AbortController());
			return aiResponse;
		}
	};

	const handleSubmit = async (e: FormEvent) => {
		e.preventDefault();
		if (!input.trim()) return;

		const userMessage: Message = { text: input, isUser: true };

		setMessages((prev) => [...prev, userMessage]);

		setInput('');
		setIsLoading(true);

		if (!aiConfiguration) {
			alert('Please select an AI model');
			setIsLoading(false);
			return;
		}

		//if the conversation does not yet have a title, get a title from the first message
		if (!conversationTitle || conversationTitle === 'New conversation') {
			//make a fetch to ollama to get a summary of the conversation/title based on the first message
			const response = await fetch(ollamaApiUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model: aiConfiguration.config.model,
					prompt: `Generate a 5-7 word title for this conversation based on this first message (only provide the title in the fewest characters possible, no brackets or any additional punctuation):\n${input}`,
					stream: false,
				}),
			});

			const body = await response.json();

			if (!response.ok) {
				console.error('Network response was not ok');
			}

			const title = body.response;
			setConversationTitle(title);

			console.log(title);

			setConversations((prev) =>
				prev.map((conversation) => (conversation.id === conversationId ? { ...conversation, title } : conversation))
			);
		}

		const conversationHistory = messages.map((msg) => `${msg.isUser ? 'Human' : 'AI'}: ${msg.text}`).join('\n');

		await streamResponse(input, conversationHistory);

		setIsLoading(false);
	};

	//when the messages change, store them in the db
	useEffect(() => {
		const storeMessages = async () => {
			// Don't store empty conversations
			if (messages.length === 0) {
				return;
			}

			const store = db.transaction(storeName, 'readwrite').objectStore(storeName);
			const isNewConversation = !!!conversationId;
			const objectData = conversationId
				? { id: conversationId, title: conversationTitle, messages }
				: { title: conversationTitle, messages };
			const value = await store.put(objectData);
			setConversationId(value);

			if (isNewConversation) {
				const firstConversation = conversations[0];
				firstConversation.id = value;
				setConversations((prev: Conversation[]) => [firstConversation, ...prev.slice(1)]);
				return;
			}

			const store2 = db.transaction(storeName, 'readwrite').objectStore(storeName);
			const conversation = await store2.get(conversationId);
			setConversationTitle(conversation.title);
		};

		if (db) {
			storeMessages();
		}
	}, [messages]);

	const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
		// Send message on Enter without Shift
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSubmit(e as unknown as FormEvent);
		}
		// Allow Shift+Enter for new line
		if (e.key === 'Enter' && e.shiftKey) {
			e.preventDefault();
			setInput((prev) => prev + '\n');
		}
	};

	return (
		<div className="flex flex-col flex-grow flex-1 bg-white dark:bg-zinc-800">
			<main className="overflow-y-scroll scrollbar-thin dark:scrollbar-thumb-zinc-700 dark:scrollbar-track-zinc-900 overflow-x-hidden flex flex-col flex-1">
				<div className="flex flex-col flex-1 max-w-xl m-auto w-full">
					<div className="flex-grow overflow-auto mb-4 px-4 pt-4">
						<div className="mx-auto space-y-2">
							{messages.map((message, index) => (
								<div key={index} className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}>
									<div
										className={`p-2 border-l-2 text-sm ${
											message.isUser
												? 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 text-zinc-900 dark:text-white'
												: 'bg-zinc-100 dark:bg-zinc-600 border-zinc-300 text-zinc-900 dark:text-white'
										} font-mono`}
									>
										<ReactMarkdown>{message.text}</ReactMarkdown>
									</div>
								</div>
							))}
							{isLoading && !streamStarted && (
								<div className="text-center text-sm text-zinc-600 dark:text-white font-mono">Thinking...</div>
							)}
						</div>
						<div ref={messagesEndRef} />
					</div>

					<div
						className="p-4 sticky bottom-0 w-full bg-white dark:bg-zinc-600 border-t border-zinc-200 dark:border-zinc-500
		 	 
		  "
					>
						<form
							onSubmit={handleSubmit}
							className="relative max-w-4xl mx-auto flex items-center
				border-l-2 border-zinc-400 bg-zinc-100 dark:bg-zinc-700 text-sm text-zinc-900 dark:text-white  focus:border-zinc-500 
			  "
						>
							<textarea
								ref={textareaRef}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								className="appearance-none w-full p-2 resize-none focus:outline-none bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white  "
								placeholder="Type your message..."
								rows={1}
								style={{ maxHeight: '120px' }}
							/>
							<button
								type={isLoading && streamStarted ? 'button' : 'submit'}
								onClick={
									isLoading && streamStarted
										? () => {
												console.log('aborting');
												controller.abort();
												setController(new AbortController());
										  }
										: undefined
								}
								className="p-2 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-500"
								disabled={!isLoading && !input.trim()}
							>
								{isLoading && streamStarted ? <Pause size={16} /> : <Send size={16} />}
							</button>
						</form>
					</div>
				</div>
			</main>
		</div>
	);
};

export default ConversationThread;
