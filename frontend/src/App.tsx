import './App.css';
import ChatApp from './components/ChatApp.tsx';
import { useEffect, useState } from 'react';
import { tokenName, siteverifyTokenName } from './consts.ts';

function App() {
	const [siteverifyToken, setSiteverifyToken] = useState<string | undefined>(localStorage.getItem(siteverifyTokenName) || undefined);
	const [token, setToken] = useState<string | undefined>(localStorage.getItem(tokenName) || undefined);

	window.addEventListener('storage', (event) => {
		console.log('storage event');
		console.log(event);
		setSiteverifyToken(localStorage.getItem(siteverifyTokenName) || undefined);
	});

	async function fetchToken() {
		const response = await fetch('/api/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ token: siteverifyToken }),
		});
		const data = await response.json();
		setToken(data.workersToken);
	}

	useEffect(() => {
		console.log('siteverifytoken is ', siteverifyToken);
		fetchToken();
	}, [siteverifyToken]);

	return <ChatApp token={token} />;
}

export default App;
