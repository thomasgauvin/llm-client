import { useState, useEffect } from "react";

const useAiConfiguration = (initialConfig?: {
  type: string;
  config: any;
  url: string;
  model: string;
}) => {
  const [aiConfiguration, setAiConfiguration] = useState(() => {
    const stored = localStorage.getItem("aiConfig");
    if (stored) {
      return JSON.parse(stored);
    }
    return initialConfig || {};
  });

  useEffect(() => {
    localStorage.setItem("aiConfig", JSON.stringify(aiConfiguration));
  }, [aiConfiguration]);

  return [aiConfiguration, setAiConfiguration];
};

export default useAiConfiguration;
