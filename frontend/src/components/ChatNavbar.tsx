import React from 'react';
import { PanelLeftOpen, PanelLeftClose, Settings, Server, CloudLightning, Code } from 'lucide-react';
import ChatThemeDropdown from './ChatThemeDropdown.tsx';
import { AiConfiguration } from './ChatApp.tsx';

interface ChatNavbarProps {
	sidebarVisible: boolean;
	setSidebarVisible: React.Dispatch<React.SetStateAction<boolean>>;
	aiConfiguration: AiConfiguration | undefined;
	setShowConfigModal: React.Dispatch<React.SetStateAction<boolean>>;
}

const ChatNavbar: React.FC<ChatNavbarProps> = ({ sidebarVisible, setSidebarVisible, aiConfiguration, setShowConfigModal }) => {
	return (
		<div className="border-b border-zinc-200 dark:border-zinc-600">
			<div className="m-2 flex items-center justify-between">
				<div className="flex items-center">
					<button
						onClick={() => setSidebarVisible(!sidebarVisible)}
						className="mr-2 transition-colors text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-500"
					>
						{sidebarVisible ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
					</button>
					<h1 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">LLM Client</h1>
				</div>
				<div className="flex items-center gap-4">
					<ChatThemeDropdown />
					<button
						onClick={() => setShowConfigModal(true)}
						className="inline-flex text-xs w-32 justify-between border-zinc-300 dark:border-zinc-600 border items-center gap-x-1.5 bg-zinc-100 dark:bg-zinc-900 px-2 py-2 text-sm font-normal text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800"
					>
						{aiConfiguration ? (
							<>
								{aiConfiguration.type === 'ollama' ? (
									<Server size={16} />
								) : aiConfiguration.type === 'cloudflare' ? (
									<CloudLightning size={16} />
								) : (
									<Code size={16} />
								)}
								<span className="capitalize flex space-x-1">
									<span>{aiConfiguration.type}</span>
									<span className="text-xs text-zinc-500 dark:text-zinc-400 truncate text-ellipsis">
										{aiConfiguration?.config?.model?.substring(0, 7)}...
									</span>
								</span>
							</>
						) : (
							<>
								<Settings size={16} />
								<span>Configure AI</span>
							</>
						)}
					</button>
				</div>
			</div>
		</div>
	);
};

export default ChatNavbar;

//     {
//       name: "cloudflare",
//       title: "Cloudflare",
//       description: "Use Cloudflare Workers AI to access open-source AI models.",
//       iconRenderFunction: (customClass) => (
//         <CloudLightning className={customClass} />
//       ),
//       configurationSteps: [
//         {
//           label: "Configure Cloudflare Account ID",
//           preInputText: "Enter your Cloudflare Account ID:",
//           input: {
//             value: cloudflareAccountId,
//             disabled: false,
//             multiline: false,
//             onChange: (e) => setCloudflareAccountId(e.target.value),
//           },
//         },
//         {
//           label: "Configure API Token",
//           preInputText: "Enter your Cloudflare API token:",
//           input: {
//             value: cloudflareToken,
//             disabled: false,
//             multiline: false,
//             onChange: (e) => setCloudflareToken(e.target.value),
//           },
//         },
//         {
//           label: "Run a reverse proxy server",
//           preInputText:
//             "To avoid CORS issues, run a reverse proxy server with the following command:",
//           input: {
//             value:
//               "brew install caddy\ncaddy reverse-proxy --from https://localhost:8443 --to https://api.cloudflare.com",
//             disabled: true,
//             multiline: true,
//           },
//         },
//         {
//           label: "Configure reverse proxy URL",
//           preInputText: "Enter the URL of your reverse proxy server:",
//           input: {
//             value: cloudflareUrl,
//             disabled: false,
//             multiline: false,
//             onChange: (e) => setCloudflareUrl(e.target.value),
//           },
//         },
//         {
//           label: "Select Cloudflare Model",
//           preInputText: "Select the model you want to use:",
//           input: {
//             type: "select",
//             value: selectedModel,
//             options: cloudflareModels.map((model) => ({
//               value: model.name,
//               label: `${model.name} (${model.details.parameter_size})`,
//             })),
//             onChange: (e) => {
//               setSelectedModel(e.target.value);
//               setCloudflareAccessVerified(true);
//             },
//             disabled: cloudflareModels.length === 0,
//           },
//           postInputText:
//             cloudflareModels.length === 0
//               ? "No models found. Make sure you've entered your Cloudflare credentials correctly and that Cloudflare is accessible."
//               : undefined,
//         },
//       ],
//       verificationSteps: [
//         {
//           label: "Test Cloudflare API connection",
//           buttonRenderFunction: (onClick) => <TestButton onClick={onClick} />,
//           buttonOnClick: async () => {
//             setTestStatus({ ...testStatus, cloudflare: "Testing..." });
//             try {
//               // Add verification logic for Cloudflare API

//               const success = true;
//               setCloudflareAccessVerified(success);
//               setTestStatus({
//                 ...testStatus,
//                 cloudflare: success
//                   ? "Successfully tested!"
//                   : "Test failed. Please ensure configurations are correct and try again.",
//               });
//               return success;
//             } catch (error) {
//               setCloudflareAccessVerified(false);
//               setTestStatus({
//                 ...testStatus,
//                 cloudflare:
//                   "Test failed. Please ensure configurations are correct and try again.",
//               });
//               return false;
//             }
//           },
//           status: testStatus.cloudflare,
//         },
//       ],
//     },
//     {
//       name: "custom",
//       title: "Custom Handler",
//       iconRenderFunction: (customClass) => <Code className={customClass} />,
//       description:
//         "Implement your own custom handler for AI model interactions.",
//       configurationSteps: [
//         {
//           label: "Define AI Model Handler",
//           preInputText:
//             "Implement a function that handles AI model interactions. Here's an example using OpenAI's streaming API:",
//           input: {
//             value:
//               customFunction ||
//               `async function callAIModel(message) {
//   const response = await fetch('https://api.openai.com/v1/chat/completions', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': \`Bearer \${process.env.OPENAI_API_KEY}\`
//     },
//     body: JSON.stringify({
//       model: 'gpt-3.5-turbo',
//       messages: [{ role: 'user', content: message }],
//       stream: true
//     })
//   });

//   const reader = response.body.getReader();
//   const decoder = new TextDecoder();

//   while (true) {
//     const { done, value } = await reader.read();
//     if (done) break;

//     const chunk = decoder.decode(value);
//     const lines = chunk.split('\\n').filter(line => line.trim() !== '');

//     for (const line of lines) {
//       if (line.includes('[DONE]')) continue;
//       const json = JSON.parse(line.replace('data: ', ''));
//       if (json.choices[0].delta.content) {
//         yield json.choices[0].delta.content;
//       }
//     }
//   }
// }`,
//             disabled: false,
//             multiline: true,
//             onChange: setCustomFunction,
//           },
//         },
//       ],
//       verificationSteps: [
//         {
//           label: "Test AI Model Handler",
//           buttonRenderFunction: (onClick) => <TestButton onClick={onClick} />,
//           buttonOnClick: () => {
//             setTestStatus({ ...testStatus, custom: "Testing..." });
//             try {
//               const success = !!customFunction;
//               setCustomFunctionVerified(success);
//               setTestStatus({
//                 ...testStatus,
//                 custom: success
//                   ? "Successfully tested!"
//                   : "Test failed. Please ensure configurations are correct and try again.",
//               });
//               return success;
//             } catch (error) {
//               setCustomFunctionVerified(false);
//               setTestStatus({
//                 ...testStatus,
//                 custom:
//                   "Test failed. Please ensure configurations are correct and try again.",
//               });
//               return false;
//             }
//           },
//           status: testStatus.custom,
//         },
//       ],
//     },
