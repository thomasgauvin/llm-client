import React, { useState, useEffect } from 'react';
import { openDB, IDBPDatabase } from 'idb';
import ConfigurationModal from './ConfigurationModal.tsx';
import useAiConfiguration from '../hooks/useAiConfiguration.ts';
import ChatSidebar from './ChatSidebar.tsx';
import ChatNavbar from './ChatNavbar.tsx';
import ConversationThread from './ConversationThread.tsx'; // Import ConversationThread component
import { storeName, dbName } from '../consts.ts';

interface Conversation {
	id?: number;
	title: string;
	messages: any[];
}
export interface AiConfiguration {
	type: string;
	config: {
		url?: string;
		model?: string;
		token?: string;
		accountId?: string;
		function?: Function;
	};
}

interface ChatAppProps {
	token: string | undefined;
}

const ChatApp: React.FC<ChatAppProps> = ({ token }) => {
	const [aiConfiguration, setAiConfiguration] = useAiConfiguration(undefined) as [
		AiConfiguration | undefined,
		React.Dispatch<React.SetStateAction<AiConfiguration | null>>
	];
	const [,] = useState<boolean>(true);
	const [showConfigModal, setShowConfigModal] = useState<boolean>(true);
	const [conversations, setConversations] = useState<Conversation[]>([]);
	const [conversationId, setConversationId] = useState<number | undefined>(undefined);
	const [, setConversationTitle] = useState<string>('New conversation');
	const [db, setDb] = useState<IDBPDatabase | null>(null);
	const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);
	const [ollamaApiBaseUrl, setOllamaApiBaseUrl] = useState<string>(
		localStorage.getItem('ollama_api_base_url') || 'http://localhost:11434/api'
	);
	const [, setOllamaApiUrl] = useState<string>(`${ollamaApiBaseUrl}/api/generate`);
	const [credits, setCredits] = useState<number | null>(null);

	//setup db at the beginning
	useEffect(() => {
		const initDb = async () => {
			const db = await openDB(dbName, 1, {
				upgrade(db) {
					db.createObjectStore(storeName, {
						keyPath: 'id',
						autoIncrement: true,
					});
				},
			});
			setDb(db);
		};
		initDb();
	}, []);

	//at the beginning, make a simple ping to ollama to check if its up and running
	//we can make a get to localhost:11434 to check if ollama is running
	useEffect(() => {
		// const pingOllama = async () => {
		// 	try {
		// 		const response = await fetch(ollamaApiBaseUrl);
		// 		if (!response.ok) {
		// 			throw new Error('Network response was not ok');
		// 		}
		// 		setOllamaRunning(true);
		// 	} catch (error) {
		// 		console.error('Error pinging Ollama:', error);
		// 		setOllamaRunning(false);
		// 	}
		// };
		// pingOllama();
	}, []);

	//once the db is set, get all the conversations
	useEffect(() => {
		const getConversations = async () => {
			if (!db) return;

			const conversations = (await db.getAll(storeName)) as Conversation[];
			const inverseConversations = conversations.reverse();
			setConversations(inverseConversations);

			//add an empty conversation if the last one is not empty
			if (conversations.length === 0 || conversations[0].messages.length > 0 || conversations[0].title !== 'New conversation') {
				setConversations((prev) => [{ title: 'New conversation', messages: [] }, ...prev]);
			} else {
				setConversationId(conversations[0].id);
			}
		};

		getConversations();
	}, [db]);

	const deleteConversation = async (id: number) => {
		const shouldDelete = window.confirm('Are you sure you want to delete this conversation?');
		if (!shouldDelete) return;
		await db!.delete(storeName, id);
		setConversations((prev) => prev.filter((conv) => conv.id !== id));

		//set conversation id to the last conversation
		setConversationId(conversations.length > 1 ? conversations[0].id : undefined);
	};

	const editConversationTitle = async (id: number, newTitle: string) => {
		const conversation = (await db!.get(storeName, id)) as Conversation;
		conversation.title = newTitle;
		await db!.put(storeName, conversation);
		setConversations((prev) => prev.map((conv) => (conv.id === id ? { ...conv, title: newTitle } : conv)));
	};

	const handleConfigurationComplete = (config: AiConfiguration) => {
		setAiConfiguration(config);
		setShowConfigModal(false);

		// Update API URL if Ollama is selected
		if (config.type === 'ollama') {
			setOllamaApiBaseUrl(config.config.url + '/api' || '');
			setOllamaApiUrl(`${config.config.url}/api/generate`);
			localStorage.setItem('ollama_api_base_url', config.config.url + '/api' || '');
		}
	};

	const startNewConversation = () => {
		// If the last conversation is "New conversation" with empty messages, override it
		if (conversations.length > 0 && conversations[0].title === 'New conversation' && conversations[0].messages.length === 0) {
			setConversationId(conversations[0].id);
			setConversationTitle('New conversation');
			return;
		}

		// Create a new conversation
		setConversationId(undefined);
		setConversationTitle('New conversation');
		setConversations((prev) => [{ title: 'New conversation', messages: [] }, ...prev]);
	};

	// Add function to fetch credits
	const fetchCredits = async () => {
		if (!token) return;
		try {
			const response = await fetch('/api/credits', {
				method: 'POST',
				body: JSON.stringify({
					token: token,
				}),
			});
			const data = await response.json();

			setCredits(data.credits);
		} catch (error) {
			console.error('Error fetching credits:', error);
		}
	};

	// Add effect to fetch credits when using included provider
	useEffect(() => {
		if (aiConfiguration?.type === 'included') {
			fetchCredits();
		}
	}, [aiConfiguration, token]);

	return (
		<div className="flex flex-col h-dvh w-screen overflow-clip bg-white dark:bg-zinc-800">
			<ChatNavbar
				credits={credits}
				sidebarVisible={sidebarVisible}
				setSidebarVisible={setSidebarVisible}
				aiConfiguration={aiConfiguration}
				setShowConfigModal={setShowConfigModal}
			/>
			<div className="flex flex-row flex-grow flex-1 overflow-auto">
				<ChatSidebar
					conversations={conversations}
					conversationId={conversationId}
					setConversationId={setConversationId}
					deleteConversation={deleteConversation}
					editConversationTitle={editConversationTitle}
					visible={sidebarVisible}
					startNewConversation={startNewConversation}
				/>

				<ConversationThread
					token={token}
					ollamaApiBaseUrl={ollamaApiBaseUrl}
					conversations={conversations}
					conversationId={conversationId}
					setConversationId={setConversationId}
					setConversations={setConversations}
					db={db}
					aiConfiguration={aiConfiguration}
					credits={credits}
					setCredits={setCredits}
				/>
			</div>

			<ConfigurationModal
				token={token}
				isOpen={showConfigModal}
				setIsOpen={setShowConfigModal}
				onConfigurationComplete={handleConfigurationComplete}
				initialConfig={aiConfiguration}
			/>
		</div>
	);
};

export default ChatApp;
