import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import type { ExtensionModule } from "../../types";
import { log } from "../../utils";

// ─── Claude Code Plugin Bridge ─────────────────────────────────────
// On VS Code extension activate:
// 1. Copies claude-plugin/ to a location Claude Code can discover
// 2. Registers the plugin in Claude Code settings if needed
// 3. Sets up .teamshare/ in the workspace

const PLUGIN_NAME = "teamshare";

export const pluginBridgeModule: ExtensionModule = {
  id: "pluginBridge",

  async activate(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return;
    }

    const projectRoot = workspaceFolders[0].uri.fsPath;
    const extensionPath = context.extensionPath;
    const pluginSourceDir = path.join(extensionPath, "claude-plugin");

    // 1. Copy plugin to user's Claude plugins directory
    const claudePluginsDir = path.join(getClaudeConfigDir(), "plugins", "cache", PLUGIN_NAME);
    try {
      copyDirRecursive(pluginSourceDir, claudePluginsDir);
      makeHooksExecutable(path.join(claudePluginsDir, "hooks"));
      log(`Claude plugin installed to ${claudePluginsDir}`);
    } catch (err) {
      log(`Failed to install Claude plugin: ${err}`, "error");
    }

    // 2. Register plugin in Claude Code settings
    registerPluginInSettings(claudePluginsDir);

    // 3. Ensure .teamshare/ exists in workspace
    ensureTeamShareDir(projectRoot);

    // 4. Show status
    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
    statusItem.text = "$(people) TeamShare";
    statusItem.tooltip = "TeamShare session intelligence active";
    statusItem.command = "myExtension.sessions.search";
    statusItem.show();

    context.subscriptions.push(statusItem);

    log("Plugin bridge activated - Claude Code commands available");
  },
};

function getClaudeConfigDir(): string {
  const home = process.env["HOME"] ?? process.env["USERPROFILE"] ?? "";
  return path.join(home, ".claude");
}

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    return;
  }

  fs.mkdirSync(dest, { recursive: true });

  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function makeHooksExecutable(hooksDir: string): void {
  if (!fs.existsSync(hooksDir)) {
    return;
  }
  for (const file of fs.readdirSync(hooksDir)) {
    if (file.endsWith(".sh")) {
      fs.chmodSync(path.join(hooksDir, file), 0o755);
    }
  }
}

function registerPluginInSettings(pluginDir: string): void {
  // The plugin hooks are in the plugin dir itself (hooks.json)
  // Claude Code auto-discovers plugins from the plugin dir
  // We just need to register the install path

  const installedPlugins = path.join(getClaudeConfigDir(), "plugins", "installed_plugins.json");
  try {
    let installed: Record<string, unknown> = { version: 2, plugins: {} };
    if (fs.existsSync(installedPlugins)) {
      installed = JSON.parse(fs.readFileSync(installedPlugins, "utf-8"));
    }

    const plugins = (installed["plugins"] ?? {}) as Record<string, unknown[]>;
    if (!plugins[PLUGIN_NAME]) {
      plugins[PLUGIN_NAME] = [
        {
          scope: "user",
          installPath: pluginDir,
          version: "0.1.0",
          installedAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString(),
        },
      ];
      installed["plugins"] = plugins;
      fs.writeFileSync(installedPlugins, JSON.stringify(installed, null, 2));
      log("Registered teamshare plugin in Claude Code");
    }
  } catch (err) {
    log(`Failed to register plugin: ${err}`, "warn");
  }
}

function ensureTeamShareDir(projectRoot: string): void {
  const teamshareDir = path.join(projectRoot, ".teamshare");
  const dirs = [
    teamshareDir,
    path.join(teamshareDir, "sessions", "summaries"),
    path.join(teamshareDir, "sessions", "vectors"),
    path.join(teamshareDir, "search"),
  ];

  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Ensure in .gitignore
  const gitignorePath = path.join(projectRoot, ".gitignore");
  try {
    const content = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, "utf-8") : "";
    if (!content.includes(".teamshare")) {
      fs.appendFileSync(gitignorePath, content.endsWith("\n") ? ".teamshare/\n" : "\n.teamshare/\n");
    }
  } catch {
    // Non-critical
  }
}
