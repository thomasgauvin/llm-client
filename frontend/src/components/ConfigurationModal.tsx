import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Server, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { AiConfiguration } from './ChatApp';

interface ConfigurationModalProps {
	isOpen: boolean;
	setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
	onConfigurationComplete: (config: AiConfiguration) => void;
	initialConfig: AiConfiguration | undefined;
}

const ConfigurationModal: React.FC<ConfigurationModalProps> = ({ isOpen, setIsOpen, onConfigurationComplete, initialConfig }) => {
	const [selectedOption, setSelectedOption] = useState<string | null>(() => {
		const stored = localStorage.getItem('aiConfig');
		if (stored) {
			const config = JSON.parse(stored);
			return config.type;
		}
		return initialConfig?.type || null;
	});

	const [config, setConfig] = useState<AiConfiguration>(() => {
		const stored = localStorage.getItem('aiConfig');
		if (stored) {
			return JSON.parse(stored);
		}
		return initialConfig || { type: '', config: {} };
	});

	const [cloudflareUrl] = useState<string>(() => {
		return config.type === 'cloudflare' ? config.config?.url || 'https://localhost:8443' : 'https://localhost:8443';
	});

	const [ollamaUrl, setOllamaUrl] = useState<string>(() => {
		return config.type === 'ollama' ? config.config?.url || 'https://localhost:8443' : 'https://localhost:8443';
	});

	const [selectedModel, setSelectedModel] = useState<string>(() => {
		return config.type === 'ollama' ? config.config?.model || '' : '';
	});

	const [customFunction] = useState<Function>(() => {
		return '';
	});

	const [cloudflareToken] = useState<string>(() => {
		return config.type === 'cloudflare' ? config.config?.token || '' : '';
	});

	const [cloudflareAccountId] = useState<string>(() => {
		return config.type === 'cloudflare' ? config.config?.accountId || '' : '';
	});

	const [, setCloudflareModels] = useState<any[]>([]);
	const [ollamaModels, setOllamaModels] = useState<any[]>([]);
	const [testStatus, setTestStatus] = useState<{ [key: string]: string }>({});

	// Verification states
	const [ollamaOriginVerified, setOllamaOriginVerified] = useState<boolean>(false);
	const [ollamaModelsVerified, setOllamaModelsVerified] = useState<boolean>(false);
	const [cloudflareAccessVerified] = useState<boolean>(false);
	const [customFunctionVerified] = useState<boolean>(false);

	const [platform, setPlatform] = useState<string | null>(null);

	const handleModelChange = async (model: string) => {
		setSelectedModel(model);
		setOllamaModelsVerified(true);
		await testOllamaAccess();
	};

	useEffect(() => {
		const checkPlatform = async () => {
			//@ts-ignore
			if (window.electron) {
				//@ts-ignore
				const plat = await window.electron.platform();
				setPlatform(plat);
			} else {
				setPlatform('web');
			}
		};
		checkPlatform();
	}, []);

	const fetchOllamaModels = async (url: string) => {
		try {
			const response = await fetch(`${url}/api/tags`);
			const data = await response.json();
			setOllamaModels(data.models || []);
			setSelectedModel(data.models[0]?.name);
			testOllamaAccess();
		} catch (error) {
			console.error('Error fetching Ollama models:', error);
			setOllamaModels([]);
		}
	};

	useEffect(() => {
		if (selectedOption === 'ollama' && ollamaUrl) {
			fetchOllamaModels(ollamaUrl);
		}
	}, [ollamaUrl, selectedOption]);

	useEffect(() => {
		if (selectedOption === 'cloudflare' && cloudflareToken && cloudflareAccountId && cloudflareUrl) {
			console.log('fetching cloudflare models');
			fetch(`${cloudflareUrl}/client/v4/accounts/${cloudflareAccountId}/ai/models/search`, {
				headers: {
					Authorization: 'Bearer ' + cloudflareToken,
					'Content-Type': 'application/json',
				},
			})
				.then((response) => response.json())
				.then((data) => {
					setCloudflareModels(data.result || []);
				})
				.catch((error) => {
					console.error('Error fetching Cloudflare models:', error);
					setCloudflareModels([]);
				});
		}
	}, [cloudflareToken, cloudflareAccountId, selectedOption, cloudflareUrl]);

	const isCurrentStepVerified = () => {
		if (!selectedOption) return false;
		switch (selectedOption) {
			case 'ollama':
				return ollamaOriginVerified && ollamaModelsVerified && selectedModel;
			case 'cloudflare':
				return cloudflareAccessVerified && cloudflareToken && cloudflareAccountId;
			case 'custom':
				return customFunctionVerified;
			default:
				return false;
		}
	};

	const handleClose = () => {
		if (isCurrentStepVerified()) {
			handleConfigurationComplete();
		} else {
			alert('Please verify your configuration before proceeding.');
		}
	};

	const handleConfigurationComplete = () => {
		if (isCurrentStepVerified()) {
			const newConfig: AiConfiguration = {
				type: selectedOption!,
				config: {
					...(selectedOption === 'ollama' && {
						url: ollamaUrl,
						model: selectedModel,
					}),
					...(selectedOption === 'custom' && {
						function: customFunction,
					}),
					...(selectedOption === 'cloudflare' && {
						url: cloudflareUrl,
						token: cloudflareToken,
						accountId: cloudflareAccountId,
					}),
				},
			};

			localStorage.setItem('aiConfig', JSON.stringify(newConfig));
			setConfig(newConfig);
			onConfigurationComplete(newConfig);
			setIsOpen(false);
		}
	};

	const aiProviderOptions = [
		{
			name: 'ollama',
			title: 'Ollama (local)',
			description: 'Use Ollama to run AI models locally.',
			iconRenderFunction: (customClass: string) => <Server className={customClass} />,
			configurationSteps: [
				{
					label: 'Allow this site in Ollama origins',
					preInputText: `Add \`https://local-ai-chat.appsinprogress.com/\` to your Ollama origins. On MacOS, run the following terminal command:`,
					input: {
						value: `launchctl setenv OLLAMA_ORIGINS "${window.location.href.substring(0, window.location.href.length - 1)}"`,
						disabled: true,
						multiline: true,
					},
					postInputText: (
						<>
							<ReactMarkdown className="dark:text-zinc-300">
								After executing this command, restart Ollama. Refer to the [Ollama
								docs](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-allow-additional-web-origins-to-access-ollama).
							</ReactMarkdown>
						</>
					),
				},
				{
					label: 'Run a reverse proxy server',
					preInputText:
						'Ollama does not support HTTPS. Most modern browsers require requests to be made over HTTPS. To access Ollama over HTTPS, run the following commands:',
					input: {
						value: `brew install caddy
caddy reverse-proxy --from https://localhost:8443 --to http://localhost:11434\n
// to expose Ollama to your local network:
caddy reverse-proxy --from https://<YOUR_LOCAL_IP>:8443 --to http://localhost:11434`,
						disabled: true,
						multiline: true,
					},
				},
				{
					label: 'Configure reverse proxy URL',
					preInputText: 'Enter the URL of your reverse proxy server:',
					input: {
						value: ollamaUrl,
						disabled: false,
						multiline: false,
						onChange: (value: string) => {
							setTestStatus({ ...testStatus, ollama: '' });
							setOllamaOriginVerified(false);
							setOllamaModelsVerified(false);
							setOllamaUrl(value);
						},
					},

					postInputText: (
						<>
							Accept the self-signed certificate in your browser if you haven't already.
							<a href={ollamaUrl} className="text-blue-500 hover:underline ml-2" target="_blank" rel="noopener noreferrer">
								Accept the certificate
							</a>
						</>
					),
				},
				{
					label: 'Select Ollama Model',
					preInputText: 'Select the model you want to use:',
					input: {
						type: 'select',
						value: selectedModel,
						options: ollamaModels.map((model) => ({
							value: model.name,
							label: `${model.name} (${model.details.parameter_size})`,
						})),
						onChange: handleModelChange,
						disabled: ollamaModels.length === 0,
					},
					postInputText:
						ollamaModels.length === 0 ? (
							<>
								No models found. Make sure Ollama is running and the reverse proxy URL is correct. &nbsp;
								<button onClick={() => fetchOllamaModels(ollamaUrl)} className="text-blue-500 hover:underline">
									Refresh
								</button>
							</>
						) : undefined,
				},
			],
			verificationSteps: [
				{
					label: 'Test Ollama access',
					buttonRenderFunction: (onClick: () => void) => <TestButton onClick={onClick} />,
					buttonOnClick: async () => {
						await testOllamaAccess();
					},
					status: testStatus.ollama,
				},
			],
		},
	];

	useEffect(() => {
		if (selectedOption) {
			testCurrentStep();
		}
	}, [selectedOption]);

	const testCurrentStep = () => {
		if (selectedOption) {
			const currentStep = aiProviderOptions.find((option) => option.name === selectedOption)?.verificationSteps[0];
			if (currentStep) {
				currentStep.buttonOnClick();
			}
		}
	};

	const handleOptionSelect = (option: string) => {
		setSelectedOption(option);
	};

	const testOllamaAccess = async () => {
		setTestStatus({ ...testStatus, ollama: 'Testing...' });
		try {
			const response = await fetch(`${ollamaUrl}`);
			const success = response.ok;
			setOllamaOriginVerified(success);
			setTestStatus({
				...testStatus,
				ollama: success ? 'Successfully tested!' : 'Test failed. Please ensure configurations are correct and try again.',
			});
			setOllamaModelsVerified(true);
			return success;
		} catch (error) {
			setOllamaOriginVerified(false);
			setTestStatus({
				...testStatus,
				ollama: 'Test failed. Please ensure configurations are correct and try again.',
			});
			return false;
		}
	};

	return (
		<Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/60 dark:bg-black/80" />
				<Dialog.Content
					className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
          w-[90%] md:w-[36rem]
          bg-white dark:bg-zinc-900
          shadow-2xl dark:shadow-xl dark:shadow-zinc-800/50
          focus:outline-none
          max-h-[90vh]
          overflow-y-scroll
          border border-zinc-200 dark:border-zinc-700
          pt-6"
				>
					<div className="flex justify-end mb-2 mx-6">
						<Dialog.Close className="p-1 text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white" aria-label="Close">
							<X className="w-5 h-5" />
						</Dialog.Close>
					</div>

					<div className="space-y-4">
						<Dialog.Title className="text-lg font-medium mb-4 text-zinc-900 dark:text-white mx-6">Configure AI Provider</Dialog.Title>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6 mx-6">
							{aiProviderOptions.map((option) => (
								<button
									key={option.name}
									onClick={() => handleOptionSelect(option.name)}
									className={`border border-zinc-200 dark:border-zinc-700 p-2
                      flex flex-row items-center justify-left gap-2
                      hover:border-zinc-400 dark:hover:border-zinc-500
                      transition-all duration-300 relative
                      flex-1
                      ${
												selectedOption === option.name
													? 'bg-zinc-200 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500'
													: 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700'
											}
                      `}
								>
									<div className="text-zinc-900 dark:text-white">{option.iconRenderFunction('w-4 h-4')}</div>
									<span className="font-medium text-sm text-zinc-800 dark:text-zinc-200">{option.title}</span>
								</button>
							))}
						</div>
						<div className="space-y-4">
							{aiProviderOptions.map((option) => (
								<>
									{option.name === selectedOption && (
										<>
											{platform === 'web' && selectedOption === 'cloudflare' ? (
												<div className="space-y-4 text-sm mx-6">
													<p className="text-xs italic text-zinc-600 dark:text-zinc-400">{option.description}</p>
													<p className="text-red-600">
														The Cloudflare REST API can only be accessed through our desktop or mobile applications.
													</p>
													<div className="space-y-2">
														<a
															href="https://github.com/YOUR_REPO/releases"
															className="text-blue-500 hover:underline"
															target="_blank"
															rel="noopener noreferrer"
														>
															Download Desktop App
														</a>
													</div>
												</div>
											) : (
												<div key={option.name} className="space-y-4">
													<div className="mx-6">
														<p className="text-xs italic text-zinc-600 dark:text-zinc-400">{option.description}</p>
													</div>

													<div className="space-y-2 mx-6">
														<h3 className="text-base font-medium text-zinc-900 dark:text-white">Configuration Steps:</h3>
														{option.configurationSteps?.map((step, index) => (
															<div key={index} className="space-y-2">
																<h4 className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{step.label}</h4>
																<div
																	className="p-3 bg-zinc-50 dark:bg-zinc-800
                                    text-xs prose prose-sm leading-relaxed
                                    border border-zinc-200 dark:border-zinc-700"
																>
																	{step.preInputText && <ReactMarkdown className="dark:text-zinc-300">{step.preInputText}</ReactMarkdown>}
																	{step.input && (
																		<div className="mt-3">
																			<div className="relative">
																				{step.input.type === 'select' ? (
																					<select
																						value={step.input.value || ''}
																						onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
																							if (step.input.onChange) {
																								step.input.onChange(e.target.value);
																							}
																						}}
																						className={`w-full p-2 border
                                              appearance-none
                                              font-mono text-xs
                                              ${
																								step.input.disabled
																									? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
																									: 'bg-white dark:bg-zinc-900 dark:text-white dark:border-zinc-600'
																							}`}
																						disabled={step.input.disabled}
																					>
																						<option value="">Select a model...</option>
																						{step.input.options?.map((option) => (
																							<option key={option.value} value={option.value}>
																								{option.label}
																							</option>
																						))}
																					</select>
																				) : (
																					<textarea
																						value={step.input.value || ''}
																						onChange={(e) => {
																							if (step.input.onChange) {
																								step.input.onChange(e.target.value);
																							}
																						}}
																						className={`w-full p-2 border
                                              appearance-none
                                              font-mono text-xs
                                              ${
																								step.input.disabled
																									? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400'
																									: 'bg-white dark:bg-zinc-900 dark:text-white dark:border-zinc-600'
																							}`}
																						rows={Math.max(2, (step.input.value || '').split('\n').length + 2)}
																						disabled={step.input.disabled}
																					/>
																				)}
																			</div>
																		</div>
																	)}
																	{step.postInputText && (
																		<div className="mt-3">
																			<div className="dark:text-zinc-300">{step.postInputText}</div>
																		</div>
																	)}
																</div>
															</div>
														))}
													</div>

													{option.verificationSteps && (
														<div className="space-y-3 mx-6">
															<h3 className="text-base font-medium text-zinc-900 dark:text-white">Verification:</h3>
															{option.verificationSteps.map((step, index) => (
																<div
																	key={index}
																	className="flex flex-col space-y-2
                                    border border-zinc-200 dark:border-zinc-700
                                    p-3 bg-zinc-50 dark:bg-zinc-800"
																>
																	<div className="flex items-center justify-between text-sm">
																		<span className="text-xs text-zinc-700 dark:text-zinc-300">{step.label}</span>
																		{step.buttonRenderFunction(step.buttonOnClick)}
																	</div>
																	{step.status && (
																		<span
																			className={`text-xs ${
																				step.status === 'Testing...'
																					? 'text-zinc-600 dark:text-zinc-400'
																					: step.status.includes('Successfully')
																					? 'text-green-600 dark:text-green-400'
																					: 'text-red-600 dark:text-red-400'
																			}`}
																		>
																			{step.status}
																		</span>
																	)}
																</div>
															))}
														</div>
													)}

													<div className="flex justify-end items-center pt-4 sticky bottom-0 bg-white dark:bg-zinc-900 p-4 shadow-2xl">
														<div className="mr-4 text-xs text-zinc-400 dark:text-zinc-500">
															{testStatus.ollama === 'Successfully tested!' && (
																<span className="text-green-600 dark:text-green-400">{testStatus.ollama}</span>
															)}
														</div>
														<button
															onClick={handleConfigurationComplete}
															disabled={!isCurrentStepVerified()}
															className={`px-5 py-2 text-sm transition-all duration-300 ${
																isCurrentStepVerified()
																	? 'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-black dark:hover:bg-zinc-100'
																	: 'bg-zinc-100 text-zinc-400 cursor-not-allowed dark:bg-zinc-800 dark:text-zinc-600'
															}`}
														>
															Complete Configuration
														</button>
													</div>
												</div>
											)}
										</>
									)}
								</>
							))}
						</div>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
};

function TestButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			className="px-3 py-1 bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-500 dark:hover:bg-zinc-600 dark:text-zinc-300 text-zinc-700 border border-zinc-200 dark:border-zinc-700"
			onClick={onClick}
		>
			Test
		</button>
	);
}

export default ConfigurationModal;
