import './App.css';
import ChatApp from './components/ChatApp.tsx';
import { useState } from 'react';
import { tokenName } from './consts.ts';

function App() {
	const [token, setToken] = useState<string | undefined>(localStorage.getItem(tokenName) || undefined);

	window.addEventListener('storage', () => setToken(localStorage.getItem(tokenName) || undefined));

	return <ChatApp token={token} />;
}

export default App;
