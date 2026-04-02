import * as vscode from "vscode";
import type { CommandDefinition, ExtensionModule } from "../types";
import { log } from "../utils";

// ─── Command Registry ──────────────────────────────────────────────
// Add new commands by pushing to `commands` array.
// Each command auto-registers on activate.

const commands: CommandDefinition[] = [
  {
    id: "myExtension.helloWorld",
    handler: () => {
      vscode.window.showInformationMessage("Hello from My Extension!");
      log("Hello World command executed");
    },
  },
  {
    id: "myExtension.showPanel",
    handler: () => {
      vscode.commands.executeCommand("myExtension.webviewView.focus");
    },
  },
];

// ─── Add your commands here ────────────────────────────────────────

export function registerCommand(command: CommandDefinition): void {
  commands.push(command);
}

// ─── Commands Module ───────────────────────────────────────────────

export const commandsModule: ExtensionModule = {
  id: "commands",
  activate(context) {
    for (const cmd of commands) {
      context.subscriptions.push(
        vscode.commands.registerCommand(cmd.id, cmd.handler)
      );
    }
    log(`Registered ${commands.length} commands`);
  },
};
