import * as vscode from "vscode";
import type { ExtensionModule } from "../../../types";
import type { EmbeddingConfig, SessionRegistryEntry } from "./types";
import { log, getConfig } from "../../../utils";
import { ensureTeamShareDirs } from "./identity/config";
import { resolveIdentity, getGitBranch } from "./identity/resolver";
import { parseSessionFile } from "./summary/parser";
import { generateSummary, generateTags, generateTitle, computeDuration } from "./summary/generator";
import { SummaryUpdater } from "./summary/updater";
import { SearchPipeline } from "./search/pipeline";
import { EmbeddingManager } from "./embedding/manager";
import { SessionTreeProvider } from "./views/session-tree";
import { SessionSearchView } from "./views/search-view";

// ─── Session Intelligence Module ───────────────────────────────────
// Provides session identity, summarization, search, and awareness.

export const sessionIntelligenceModule: ExtensionModule = {
  id: "sessionIntelligence",

  async activate(context) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      log("Session Intelligence: no workspace folder, skipping");
      return;
    }

    const projectRoot = workspaceFolders[0].uri.fsPath;

    // Ensure .teamshare directory structure exists
    ensureTeamShareDirs(projectRoot);

    // ─── Identity ────────────────────────────────────────────────
    const identity = resolveIdentity(projectRoot);
    const branch = getGitBranch(projectRoot);
    log(`Session Intelligence: user=${identity.user}, branch=${branch}`);

    // ─── Summary Updater ─────────────────────────────────────────
    const summaryUpdater = new SummaryUpdater(projectRoot);

    // ─── Search Pipeline ─────────────────────────────────────────
    const searchPipeline = new SearchPipeline(projectRoot);

    // ─── Embedding (optional) ────────────────────────────────────
    const embeddingConfig: EmbeddingConfig = {
      provider: getConfig("teamshare.sessionIntelligence.embedding.provider", "none") as EmbeddingConfig["provider"],
      model: getConfig("teamshare.sessionIntelligence.embedding.model", "text-embedding-3-small"),
      dimensions: getConfig("teamshare.sessionIntelligence.embedding.dimensions", 256),
    };

    const embeddingManager = new EmbeddingManager(projectRoot, embeddingConfig);
    if (embeddingManager.enabled) {
      embeddingManager.startBackgroundIndexing();
      log("Session Intelligence: embedding background indexing started");
    }

    // ─── Tree View ───────────────────────────────────────────────
    const treeProvider = new SessionTreeProvider(projectRoot);
    treeProvider.startAutoRefresh(15000);

    const treeView = vscode.window.createTreeView("myExtension.sessionTree", {
      treeDataProvider: treeProvider,
      showCollapseAll: true,
    });

    // ─── Search View ─────────────────────────────────────────────
    const searchView = new SessionSearchView(projectRoot);

    // ─── Commands ────────────────────────────────────────────────
    const searchCmd = vscode.commands.registerCommand(
      "myExtension.sessions.search",
      () => searchView.show()
    );

    const refreshCmd = vscode.commands.registerCommand(
      "myExtension.sessions.refresh",
      () => treeProvider.refresh()
    );

    const reindexCmd = vscode.commands.registerCommand(
      "myExtension.sessions.reindex",
      () => {
        searchPipeline.rebuildIndices();
        vscode.window.showInformationMessage("Search indices rebuilt");
      }
    );

    const identifyCmd = vscode.commands.registerCommand(
      "myExtension.sessions.identify",
      async () => {
        const { writeConfig } = await import("./identity/config");
        const user = await vscode.window.showInputBox({
          prompt: "Your name (visible to other team members)",
          value: identity.user,
        });
        if (!user) {
          return;
        }
        const role = await vscode.window.showInputBox({
          prompt: "Your role (optional)",
          value: identity.role ?? "",
        });

        writeConfig(projectRoot, {
          user,
          role: role || undefined,
          machine: identity.machine,
        });

        vscode.window.showInformationMessage(`Identity set: ${user}${role ? ` (${role})` : ""}`);
      }
    );

    const indexSessionCmd = vscode.commands.registerCommand(
      "myExtension.sessions.indexFile",
      async (fileUri: vscode.Uri) => {
        if (!fileUri) {
          const uris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            filters: { "JSONL Files": ["jsonl"] },
            title: "Select a Claude Code session file",
          });
          if (!uris || uris.length === 0) {
            return;
          }
          fileUri = uris[0];
        }

        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Notification, title: "Indexing session..." },
          async (progress) => {
            progress.report({ increment: 20, message: "Parsing..." });
            const parsed = await parseSessionFile(fileUri.fsPath);

            progress.report({ increment: 30, message: "Generating summary..." });
            const summary = generateSummary(parsed);
            const tags = generateTags(parsed);
            const title = generateTitle(parsed);
            const sessionIdentity = resolveIdentity(projectRoot);

            progress.report({ increment: 20, message: "Saving..." });
            summaryUpdater.save(parsed.sessionId, summary);

            const registryEntry: SessionRegistryEntry = {
              identity: sessionIdentity,
              branch: parsed.gitBranch ?? branch,
              project: projectRoot,
              startedAt: parsed.startedAt,
              endedAt: parsed.lastTimestamp,
              status: "completed",
              title,
              summaryFile: `summaries/${parsed.sessionId}.json`,
              tags,
              files: Array.from(parsed.filesEdited.keys()),
              stats: {
                messageCount: parsed.messageCount,
                toolCalls: parsed.toolCalls.length,
                filesCreated: Array.from(parsed.filesEdited.values()).filter((f) => f.operation === "created").length,
                filesModified: Array.from(parsed.filesEdited.values()).filter((f) => f.operation === "modified").length,
                duration: computeDuration(parsed.startedAt, parsed.lastTimestamp),
              },
            };

            searchPipeline.registerSession(parsed.sessionId, registryEntry);

            if (embeddingManager.enabled) {
              embeddingManager.queueForIndexing(parsed.sessionId);
            }

            progress.report({ increment: 30, message: "Done!" });
            treeProvider.refresh();

            vscode.window.showInformationMessage(
              `Indexed: "${title}" (${parsed.messageCount} messages, ${parsed.filesEdited.size} files)`
            );
          }
        );
      }
    );

    // ─── Register all disposables ────────────────────────────────
    context.subscriptions.push(
      treeView,
      treeProvider,
      searchCmd,
      refreshCmd,
      reindexCmd,
      identifyCmd,
      indexSessionCmd,
      { dispose: () => embeddingManager.dispose() },
      { dispose: () => summaryUpdater.dispose() },
    );

    log("Session Intelligence module activated");
  },
};
