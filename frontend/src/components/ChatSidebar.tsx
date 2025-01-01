import React from 'react';
import { Plus, Edit, Trash2 } from 'lucide-react';

interface Conversation {
	id?: number;
	title: string;
	messages: any[];
}

interface ChatSidebarProps {
	conversations: Conversation[];
	conversationId: number | undefined;
	setConversationId: React.Dispatch<React.SetStateAction<number | undefined>>;
	deleteConversation: (id: number) => void;
	editConversationTitle: (id: number, newTitle: string) => void;
	visible: boolean;
	startNewConversation: () => void;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
	conversations,
	conversationId,
	setConversationId,
	deleteConversation,
	editConversationTitle,
	visible,
	startNewConversation,
}) => {
	const newConversationButtonDisabled =
		!conversationId && conversations.length > 0 && conversations[0].title === 'New conversation' && conversations[0].messages.length === 0;

	return (
		<div
			className={`overflow-y-scroll scrollbar-thin dark:scrollbar-thumb-zinc-700 dark:scrollbar-track-zinc-900 ${
				visible ? 'w-64' : 'w-0 overflow-hidden'
			}`}
		>
			<div className="flex flex-col justify-between h-full border-r border-zinc-200 dark:border-zinc-700 transition-all duration-300 bg-white dark:bg-zinc-900">
				<div className="flex flex-col">
					<div className="p-2 border-b border-zinc-200 dark:border-zinc-700">
						<button
							onClick={startNewConversation}
							className={`w-full flex items-center justify-left gap-2 p-2 text-sm ${
								newConversationButtonDisabled
									? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-400 dark:text-zinc-500 cursor-not-allowed hover:bg-zinc-200 dark:hover:bg-zinc-700'
									: 'bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
							}`}
							disabled={newConversationButtonDisabled}
						>
							<Plus size={16} /> New Conversation
						</button>
					</div>
					<ul className="p-2 space-y-1">
						{conversations.map((conversation, i) => (
							<li
								key={conversation.id}
								className={`cursor-pointer p-2 transition-colors font-mono ${
									conversation.id === conversationId || (!conversationId && !conversation.id)
										? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
										: 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
								}`}
								onClick={() => setConversationId(conversation.id)}
							>
								<div className="flex items-center justify-between">
									<span className="truncate flex-grow text-sm">{conversation.title}</span>
									<div className="flex space-x-2 ml-2">
										<button
											className="opacity-60 hover:opacity-100 transition-opacity"
											onClick={(e) => {
												e.stopPropagation();
												const newTitle = prompt('Enter new title:', conversation.title);
												if (newTitle) editConversationTitle(conversation.id!, newTitle);
											}}
										>
											<Edit size={14} />
										</button>
										{i !== 0 && (
											<button
												className="opacity-60 hover:opacity-100 transition-opacity"
												onClick={(e) => {
													e.stopPropagation();
													deleteConversation(conversation.id!);
												}}
											>
												<Trash2 size={14} />
											</button>
										)}
									</div>
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
};

export default ChatSidebar;
