import { join } from "path";
import { existsSync, readFileSync } from "fs";

export interface AppConfig {
  paths: {
    dataFile: string;
    passwordFile: string;
    inputDir: string;
    outputDir: string;
  };
  concurrency: number;
}

export function getConfig(): AppConfig {
  const configPath = join(process.cwd(), "config.json");
  if (!existsSync(configPath)) {
    throw new Error(`配置文件不存在: ${configPath}`);
  }
  try {
    return JSON.parse(readFileSync(configPath, "utf-8"));
  } catch (error) {
    throw new Error(`配置文件解析失败: ${error}`);
  }
}

export function validateConfig(config: AppConfig): string[] {
  const errors: string[] = [];
  if (config.concurrency < 1 || config.concurrency > 64) {
    errors.push("并发数必须在 1~64 之间");
  }
  if (!existsSync(config.paths.dataFile)) {
    errors.push(`数据文件不存在: ${config.paths.dataFile}`);
  }
  if (!existsSync(config.paths.passwordFile)) {
    errors.push(`密码文件不存在: ${config.paths.passwordFile}`);
  }
  return errors;
}
