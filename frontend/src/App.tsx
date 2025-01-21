import './App.css';
import ChatApp from './components/ChatApp.tsx';
import { useEffect, useState } from 'react';
import { tokenName, siteverifyTokenName } from './consts.ts';

function App() {
	const [siteverifyToken, setSiteverifyToken] = useState<string | undefined>(localStorage.getItem(siteverifyTokenName) || undefined);
	const [token, setToken] = useState<string | undefined>(localStorage.getItem(tokenName) || undefined);

	//we pass data from index.html and the turnstile callback using a custom event
	useEffect(() => {
		const handleTokenReceived = (event: {
			detail: {
				siteverifyToken: string;
			};
		}) => {
			setSiteverifyToken(event.detail.siteverifyToken);
		};

		//@ts-ignore
		window.addEventListener('tokenReceived', handleTokenReceived);
		return () => {
			//@ts-ignore
			window.removeEventListener('tokenReceived', handleTokenReceived);
		};
	}, []);

	async function fetchToken() {
		if (!siteverifyToken) {
			return;
		}

		const response = await fetch('/api/token', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ token: siteverifyToken }),
		});

		const data = await response.json();
		if (data.workersToken) {
			setSiteverifyToken(undefined);
			setToken(data.workersToken);
		}
	}

	useEffect(() => {
		fetchToken();
	}, [siteverifyToken]);

	return <ChatApp token={token} />;
}

export default App;
