import * as fs from "fs";
import * as path from "path";
import type { TeamShareConfig } from "../types";
import { TEAMSHARE_DIR, CONFIG_FILE } from "../types";

// ─── TeamShare Config Reader/Writer ───────────────────────────────────
// Reads/writes .teamshare/config.json in project root.

export function getTeamShareRoot(projectRoot: string): string {
  return path.join(projectRoot, TEAMSHARE_DIR);
}

export function getConfigPath(projectRoot: string): string {
  return path.join(getTeamShareRoot(projectRoot), CONFIG_FILE);
}

export function readConfig(projectRoot: string): TeamShareConfig | null {
  const configPath = getConfigPath(projectRoot);
  try {
    const raw = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(raw) as TeamShareConfig;
  } catch {
    return null;
  }
}

export function writeConfig(projectRoot: string, config: TeamShareConfig): void {
  const teamshareRoot = getTeamShareRoot(projectRoot);
  fs.mkdirSync(teamshareRoot, { recursive: true });
  const configPath = getConfigPath(projectRoot);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export function ensureTeamShareDirs(projectRoot: string): void {
  const teamshareRoot = getTeamShareRoot(projectRoot);
  const dirs = [
    teamshareRoot,
    path.join(teamshareRoot, "sessions"),
    path.join(teamshareRoot, "sessions", "summaries"),
    path.join(teamshareRoot, "sessions", "vectors"),
    path.join(teamshareRoot, "search"),
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Ensure .teamshare is in .gitignore
  const gitignorePath = path.join(projectRoot, ".gitignore");
  try {
    const content = fs.existsSync(gitignorePath)
      ? fs.readFileSync(gitignorePath, "utf-8")
      : "";
    if (!content.includes(".teamshare")) {
      const addition = content.endsWith("\n") ? ".teamshare/\n" : "\n.teamshare/\n";
      fs.appendFileSync(gitignorePath, addition);
    }
  } catch {
    // Non-critical, skip
  }
}
