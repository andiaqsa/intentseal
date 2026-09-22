import { config as loadDotenv, type DotenvConfigOutput } from "dotenv";
import { resolve } from "node:path";

interface LoadLocalEnvironmentOptions {
  cwd?: string;
  environment?: NodeJS.ProcessEnv;
}

export function loadLocalServerEnvironment({
  cwd = process.cwd(),
  environment = process.env,
}: LoadLocalEnvironmentOptions = {}): DotenvConfigOutput {
  return loadDotenv({
    path: [resolve(cwd, ".env.local"), resolve(cwd, ".env")],
    processEnv: environment,
    override: false,
    quiet: true,
  });
}
