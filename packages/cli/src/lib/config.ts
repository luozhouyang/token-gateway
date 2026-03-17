// Configuration Service

import { promises as fs } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Config {
  apiUrl?: string;
  authToken?: string;
  configPath?: string;
}

const defaultConfig: Config = {
  apiUrl: "http://localhost:8080/admin",
};

export class ConfigService {
  private static configPath = join(__dirname, "../../.proxy-config.json");

  static async load(): Promise<Config> {
    try {
      const content = await fs.readFile(this.configPath, "utf-8");
      return { ...defaultConfig, ...JSON.parse(content) };
    } catch {
      // File doesn't exist or is invalid, return default config
      return defaultConfig;
    }
  }

  static async save(config: Config): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }

  static async getApiUrl(): Promise<string> {
    const config = await this.load();
    return config.apiUrl || defaultConfig.apiUrl!;
  }

  static async getAuthToken(): Promise<string | undefined> {
    const config = await this.load();
    return config.authToken;
  }
}
