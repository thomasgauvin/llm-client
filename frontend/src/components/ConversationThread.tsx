import React, { useState, useEffect, useRef, FormEvent, KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Pause } from 'lucide-react';
import { storeName } from '../consts';
import { AiConfiguration } from './ChatApp';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github.css';
import { processDataStream, processTextStream } from '@ai-sdk/ui-utils';
import { createOllama } from 'ollama-ai-provider';
import { generateText, streamText } from 'ai';

interface Message {
	role: 'user' | 'system' | 'assistant';
	content: string;
}

interface Conversation {
	id?: number;
	title: string;
	messages: Message[];
}

interface ConversationThreadProps {
	ollamaApiBaseUrl: string;
	conversations: Conversation[];
	conversationId?: number;
	setConversationId: (id: number) => void;
	setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
	db: any;
	aiConfiguration: AiConfiguration | undefined;
	credits?: number | null;
	setCredits: React.Dispatch<React.SetStateAction<number | null>>;
}

const ConversationThread: React.FC<ConversationThreadProps> = ({
	ollamaApiBaseUrl,
	conversations,
	conversationId,
	setConversationId,
	setConversations,
	db,
	aiConfiguration,
	setCredits,
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
				return;
			}
			if (conversationId) {
				const conversation = await db.get(storeName, conversationId);

				//we changed the model of the data stored in indexdb to be role and content instead of text and isUser
				//iterate through conversation to fix it
				if (conversation) {
					conversation.messages = conversation.messages.map((message: any) => {
						if (message.text && message.isUser) {
							return {
								role: message.isUser ? 'user' : 'assistant',
								content: message.text,
							};
						}

						return message;
					});
				}

				setMessages(conversation.messages);
			}
		};
		loadConversation();
	}, [conversationId]);

	//if the conversation id changes and the conversation id was previously undefined, create a new conversation title
	useEffect(() => {
		async function getNewConversationTitle() {
			if (
				messages.length > 1 &&
				!!aiConfiguration &&
				conversationId != undefined &&
				conversations.find((obj) => obj.id === conversationId)?.title === 'New conversation'
			) {
				const titlePrompt = `Generate a 5-7 word title for this conversation based on this first message (only provide the title in the fewest characters possible, no brackets or any additional punctuation):\n${messages[0].content}`;

				let title = '';
				if (aiConfiguration.type === 'included') {
					const response = await fetch('/api/chat', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							messages: [
								{
									role: 'user',
									content: titlePrompt,
								},
							],
						}),
					});

					if (!response.ok) {
						console.error('Failed to generate title');
						return;
					}

					const stream = await response.body;
					if (!stream) {
						console.error('Failed to generate title');
						return;
					}

					await processTextStream({
						stream,
						onTextPart: (chunk) => {
							title += chunk;
						},
					});

					//   if (!response.ok) {
					//     console.error("Failed to generate title");
					//     return;
					//   }

					//   // Read and combine all chunks from the stream
					//   const reader = response.body!.getReader();
					//   const decoder = new TextDecoder();
					//   let titleText = "";

					//   while (true) {
					//     const { done, value } = await reader.read();
					//     if (done) break;

					//     const chunk = decoder.decode(value);
					//     const lines = chunk.split("\n");

					//     for (const line of lines) {
					//       if (line.startsWith("data: ")) {
					//         try {
					//           const jsonStr = line.slice(5).trim();
					//           const parsed = JSON.parse(jsonStr);
					//           if (parsed.response) {
					//             titleText += parsed.response;
					//           }
					//         } catch (e) {
					//           console.error("Error parsing title JSON:", e);
					//         }
					//       }
					//     }
					//   }
					//   title = titleText.trim();
				} else {
					console.log(ollamaApiBaseUrl);
					const ollama = createOllama({
						baseURL: ollamaApiBaseUrl,
					});

					const text = await generateText({
						model: ollama(aiConfiguration?.config?.model as any),
						messages: [
							{
								role: 'system',
								content: `
                  - You must generate a title for this conversation based on the first message.
                  - Only provide the title in the fewest characters possible, no brackets or any additional punctuation.
                  - You must keep the title between 5-7 words.
                  - Do not respond to the message.
                `,
							},
							...messages,
						],
					});

					// const response = await fetch(ollamaApiUrl, {
					//   method: "POST",
					//   headers: {
					//     "Content-Type": "application/json",
					//   },
					//   body: JSON.stringify({
					//     model: aiConfiguration?.config?.model,
					//     prompt: titlePrompt,
					//     stream: false,
					//   }),
					// });

					// if (!response.ok) {
					//   console.error("Network response was not ok");
					//   return;
					// }

					// const body = await response.json();
					// title = body.response;
					title = text.text;
				}

				if (title) {
					setConversations((prev) =>
						prev.map((conversation) =>
							conversation.id === conversationId
								? {
										...conversation,
										title: title as string,
										id: conversationId || conversation.id,
								  }
								: conversation
						)
					);
				}
			}
		}

		getNewConversationTitle();
	}, [conversationId, messages.length]);

	const streamResponse = async (messages: Message[]) => {
		let aiResponse = '';

		if (!aiConfiguration) {
			alert('Please select an AI model');
			return;
		}

		try {
			if (aiConfiguration.type === 'included') {
				const response = await fetch('/api/chat', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						messages,
					}),
					signal: controller.signal,
				});

				if (!response.ok) {
					const error = await response.json();
					throw new Error(error.error || 'Failed to generate response');
				}

				const stream = await response.body;
				if (!stream) {
					throw new Error('Failed to generate response');
				}

				setCredits((prev) => (prev ? prev - 2 : 0));

				setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);
				setStreamStarted(true);

				await processTextStream({
					stream,
					onTextPart: (chunk) => {
						aiResponse += chunk;
						setMessages((prev) => {
							const newMessages = [...prev];
							newMessages[newMessages.length - 1].content = aiResponse;
							return newMessages;
						});
					},
				});

				// const reader = response.body!.getReader();
				// const decoder = new TextDecoder();
				// let buffer = ""; // Add buffer to handle partial chunks

				// setMessages((prev) => [...prev, { role: "system", content: "" }]);
				// setStreamStarted(true);

				// while (true) {
				//   const { done, value } = await reader.read();
				//   if (done) break;

				//   if (controller.signal.aborted) {
				//     break;
				//   }

				//   // Append new chunk to buffer and split into lines
				//   buffer += decoder.decode(value, { stream: true });
				//   const lines = buffer.split("\n");

				//   // Process all complete lines
				//   for (let i = 0; i < lines.length - 1; i++) {
				//     const line = lines[i].trim();
				//     if (line.startsWith("data: ")) {
				//       try {
				//         const jsonStr = line.slice(5).trim(); // Remove "data: " prefix
				//         const parsed = JSON.parse(jsonStr);
				//         if (parsed.response) {
				//           aiResponse += parsed.response;
				//           setMessages((prev) => {
				//             const newMessages = [...prev];
				//             newMessages[newMessages.length - 1].content = aiResponse;
				//             return newMessages;
				//           });
				//         }
				//       } catch (e) {
				//         console.error("Error parsing JSON from event stream:", e, line);
				//       }
				//     }
				//   }

				//   // Keep the last partial line in the buffer
				//   buffer = lines[lines.length - 1];
				// }

				// // Process any remaining buffer content
				// if (buffer.trim().startsWith("data: ")) {
				//   try {
				//     const jsonStr = buffer.slice(5).trim();
				//     const parsed = JSON.parse(jsonStr);
				//     if (parsed.response) {
				//       aiResponse += parsed.response;
				//       setMessages((prev) => {
				//         const newMessages = [...prev];
				//         newMessages[newMessages.length - 1].content = aiResponse;
				//         return newMessages;
				//       });
				//     }
				//   } catch (e) {
				//     console.error("Error parsing final JSON from event stream:", e);
				//   }
				// }
			} else if (aiConfiguration.type === 'ollama') {
				const ollama = createOllama({
					baseURL: ollamaApiBaseUrl,
				});

				setStreamStarted(true);

				const stream = await streamText({
					model: ollama(aiConfiguration?.config?.model as any),
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
					abortSignal: controller.signal,
				});

				const dataStream = stream.toDataStream();

				setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

				await processDataStream({
					stream: dataStream,
					onTextPart: (chunk) => {
						aiResponse += chunk;
						setMessages((prev) => {
							const newMessages = [...prev];
							newMessages[newMessages.length - 1].content = aiResponse;
							return newMessages;
						});
					},
				});

				setStreamStarted(false);

				//  processTextStream({
				//   stream,
				//   onTextPart: (chunk) => {
				//     aiResponse += chunk;
				//     setMessages((prev) => {
				//       const newMessages = [...prev];
				//       newMessages[newMessages.length - 1].content = aiResponse;
				//       return newMessages;
				//     });
				//   },
				// });

				// const fullPrompt = conversationHistory + "\nHuman: " + prompt + "\nAI:";
				// const response = await fetch(ollamaApiUrl, {
				//   method: "POST",
				//   headers: {
				//     "Content-Type": "application/json",
				//   },
				//   body: JSON.stringify({
				//     model: aiConfiguration?.config.model,
				//     prompt: fullPrompt,
				//     stream: true,
				//   }),
				//   signal: controller.signal,
				// });

				// if (!response.ok) {
				//   throw new Error("Network response was not ok");
				// }

				// const reader = response.body!.getReader();
				// const decoder = new TextDecoder();

				// setMessages((prev) => [...prev, { role: "system", content: "" }]);
				// setStreamStarted(true);

				// while (true) {
				//   console.log("streaming");
				//   console.log(JSON.stringify(controller.signal.aborted));
				//   const { done, value } = await reader.read();
				//   if (done) break;

				//   if (controller.signal.aborted) {
				//     break;
				//   }
				//   const chunk = decoder.decode(value);
				//   const lines = chunk.split("\n");
				//   lines.forEach((line) => {
				//     if (line.trim() !== "") {
				//       try {
				//         const parsed = JSON.parse(line);
				//         aiResponse += parsed.response;
				//         setMessages((prev) => {
				//           const newMessages = [...prev];
				//           newMessages[newMessages.length - 1].content = aiResponse;
				//           return newMessages;
				//         });
				//       } catch (e) {
				//         console.error("Error parsing JSON:", e);
				//       }
				//     }
				//   });
				// }
			}
		} catch (error: any) {
			if (controller.signal.aborted) {
				console.log('Stream aborted');
			} else {
				console.error('Error generating response:', error);
				setMessages((prev) => [
					...prev,
					{
						role: 'assistant',
						content:
							error.message === 'No credits remaining'
								? "You've run out of credits. Please try again later."
								: aiConfiguration.type === 'included'
								? "Sorry, I couldn't generate a response. Please try again later."
								: "Sorry, I couldn't generate a response. Please ensure Ollama is properly configured.",
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

		const userMessage: Message = { role: 'user', content: input };

		setInput('');
		setIsLoading(true);

		if (!aiConfiguration) {
			alert('Please select an AI model');
			setIsLoading(false);
			return;
		}

		setMessages((prev) => [...prev, userMessage]);

		await streamResponse([...messages, userMessage]);

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
				? {
						id: conversationId,
						title: conversations.find((obj) => obj.id === conversationId)?.title,
						messages,
				  }
				: { title: 'New conversation', messages };
			const value = await store.put(objectData);
			setConversationId(value);

			if (isNewConversation) {
				const firstConversation = conversations[0];
				firstConversation.id = value;
				setConversations((prev: Conversation[]) => [firstConversation, ...prev.slice(1)]);
				return;
			}

			const store2 = db.transaction(storeName, 'readwrite').objectStore(storeName);
			await store2.get(conversationId);
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
								<div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
									<div
										className={`p-2 border-l-2 text-sm 
                      space-y-4 prose [&>ul]:list-disc [&>ol]:list-numbered [&>ul]:list-outside [&>ol]:list-outside
                      [&>ul]:pl-4 [&>ol]:pl-4
                      ${
												message.role === 'user'
													? 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 text-zinc-900 dark:text-white'
													: 'bg-zinc-100 dark:bg-zinc-600 border-zinc-300 text-zinc-900 dark:text-white'
											} font-mono`}
									>
										<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
											{message.content}
										</ReactMarkdown>
									</div>
								</div>
							))}
							{isLoading && !streamStarted && (
								<div className="text-center p-4 text-sm text-zinc-600 dark:text-white font-mono">Thinking...</div>
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
						<div className="text-xs line-height-4 max-h-20 overflow-scroll"></div>
					</div>
				</div>
			</main>
		</div>
	);
};

export default ConversationThread;
