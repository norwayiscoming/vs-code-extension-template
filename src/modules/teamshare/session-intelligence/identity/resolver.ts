import * as os from "os";
import { execSync } from "child_process";
import type { UserIdentity } from "../types";
import { readConfig } from "./config";

// ─── Identity Resolver ─────────────────────────────────────────────
// Resolves user identity from multiple sources by priority:
// 1. .teamshare/config.json (explicit, set once)
// 2. git config user.name (fallback)
// 3. OS username (last resort)

export function resolveIdentity(projectRoot: string): UserIdentity {
  const config = readConfig(projectRoot);

  return {
    user: config?.user ?? getGitUserName() ?? getOsUsername(),
    role: config?.role,
    machine: config?.machine ?? os.hostname(),
    avatar: config?.avatar,
  };
}

function getGitUserName(): string | null {
  try {
    return execSync("git config user.name", { encoding: "utf-8" }).trim() || null;
  } catch {
    return null;
  }
}

function getOsUsername(): string {
  return os.userInfo().username;
}

export function getGitBranch(cwd: string): string {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { cwd, encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

export function getSessionId(): string | null {
  return process.env["CLAUDE_SESSION_ID"] ?? null;
}
