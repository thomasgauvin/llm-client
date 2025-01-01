import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Monitor, ChevronDown } from 'lucide-react';

interface ThemeOption {
	value: string;
	icon: ({ className }: { className: string }) => JSX.Element;
	text: string;
}

const ChatThemeDropdown: React.FC = () => {
	const [theme, setTheme] = useState<string>(() => {
		const savedTheme = localStorage.getItem('theme');
		return savedTheme || 'system';
	});

	const [isOpen, setIsOpen] = useState<boolean>(false);
	const dropdownRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const root = window.document.documentElement;

		root.classList.remove('light', 'dark');

		if (theme === 'dark') {
			root.classList.add('dark');
			localStorage.setItem('theme', 'dark');
		} else if (theme === 'light') {
			root.classList.add('light');
			localStorage.setItem('theme', 'light');
		} else {
			localStorage.removeItem('theme');
			const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
			root.classList.add(systemTheme);
		}
	}, [theme]);

	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setIsOpen(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => {
			document.removeEventListener('mousedown', handleClickOutside);
		};
	}, []);

	const themeOptions: ThemeOption[] = [
		{
			value: 'system',
			icon: ({ className }: { className: string }) => <Monitor className={className} />,
			text: 'System',
		},
		{
			value: 'light',
			icon: ({ className }: { className: string }) => <Sun className={className} />,
			text: 'Light',
		},
		{
			value: 'dark',
			icon: ({ className }: { className: string }) => <Moon className={className} />,
			text: 'Dark',
		},
	];

	const handleThemeChange = (newTheme: string) => {
		setTheme(newTheme);
		setIsOpen(false);
	};

	const currentTheme = themeOptions.find((option) => option.value === theme) || themeOptions[0];

	return (
		<div ref={dropdownRef} className="relative inline-block text-left border-zinc-300 dark:border-zinc-600 border text-xs">
			<div>
				<button
					type="button"
					onClick={() => setIsOpen(!isOpen)}
					className="inline-flex text-xs w-12 justify-between items-center border-0 bg-zinc-100 dark:bg-zinc-900 px-2 py-2 text-sm font-normal text-zinc-900 dark:text-zinc-100 shadow-sm hover:bg-zinc-200 dark:hover:bg-zinc-800"
					id="theme-menu-button"
					aria-expanded={isOpen}
					aria-haspopup="true"
				>
					<currentTheme.icon className="h-4 w-3 mr-1" />
					<ChevronDown className="-mr-1 ml-1 h-4 w-3" aria-hidden="true" />
				</button>
			</div>

			{isOpen && (
				<div
					className="absolute right-0 z-10 mt-1 w-24 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg text-xs"
					role="menu"
					aria-orientation="vertical"
					aria-labelledby="theme-menu-button"
				>
					<div className="py-1" role="none">
						{themeOptions.map((option) => (
							<button
								key={option.value}
								onClick={() => handleThemeChange(option.value)}
								className={`
                  ${
										theme === option.value
											? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
											: 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
									}
                  flex w-full items-center px-3 py-2 text-sm border-0 text-xs
                `}
								role="menuitem"
							>
								<option.icon className="h-4 w-3 mr-3" />
								{option.text}
							</button>
						))}
					</div>
				</div>
			)}
		</div>
	);
};

export default ChatThemeDropdown;
