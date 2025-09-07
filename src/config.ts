export interface Config {
  steelApiUrl: string;
  timeout: number;
  retries: number;
}

export function loadConfig(): Config {
  return {
    steelApiUrl: process.env.STEEL_API_URL || "http://localhost:3000",
    timeout: parseInt(process.env.STEEL_TIMEOUT || "30000", 10),
    retries: parseInt(process.env.STEEL_RETRIES || "3", 10),
  };
}

export const config = loadConfig();
