import * as vscode from "vscode";
import type { ExtensionModule, TreeNode } from "../types";
import { log } from "../utils";

// ─── Generic Tree Data Provider ────────────────────────────────────
// Extend this class or use it directly with custom data sources.
// Call `refresh()` to trigger a UI update.

export class BaseTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeNode | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  protected roots: TreeNode[] = [];

  refresh(element?: TreeNode): void {
    this._onDidChangeTreeData.fire(element);
  }

  setRoots(roots: TreeNode[]): void {
    this.roots = roots;
    this.refresh();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    const item = new vscode.TreeItem(
      element.label,
      element.collapsibleState ??
        (element.children?.length
          ? vscode.TreeItemCollapsibleState.Collapsed
          : vscode.TreeItemCollapsibleState.None)
    );
    item.id = element.id;
    item.description = element.description;
    item.tooltip = element.tooltip;
    item.iconPath = element.iconPath;
    item.contextValue = element.contextValue;
    item.command = element.command;
    return item;
  }

  getChildren(element?: TreeNode): TreeNode[] {
    if (!element) {
      return this.roots;
    }
    return element.children ?? [];
  }

  getParent(element: TreeNode): TreeNode | undefined {
    const findParent = (nodes: TreeNode[], target: TreeNode): TreeNode | undefined => {
      for (const node of nodes) {
        if (node.children?.some((c) => c.id === target.id)) {
          return node;
        }
        if (node.children) {
          const found = findParent(node.children, target);
          if (found) {
            return found;
          }
        }
      }
      return undefined;
    };
    return findParent(this.roots, element);
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }
}

// ─── Sample Tree Provider ──────────────────────────────────────────

function createSampleData(): TreeNode[] {
  return [
    {
      id: "getting-started",
      label: "Getting Started",
      iconPath: new vscode.ThemeIcon("rocket"),
      children: [
        {
          id: "readme",
          label: "Read the README",
          iconPath: new vscode.ThemeIcon("book"),
          command: {
            command: "myExtension.helloWorld",
            title: "Hello",
          },
        },
      ],
    },
    {
      id: "features",
      label: "Features",
      iconPath: new vscode.ThemeIcon("extensions"),
      children: [
        { id: "commands", label: "Commands", iconPath: new vscode.ThemeIcon("terminal") },
        { id: "tree-view", label: "Tree View", iconPath: new vscode.ThemeIcon("list-tree") },
        { id: "webview", label: "Webview", iconPath: new vscode.ThemeIcon("browser") },
        { id: "config", label: "Configuration", iconPath: new vscode.ThemeIcon("gear") },
        { id: "statusbar", label: "Status Bar", iconPath: new vscode.ThemeIcon("info") },
      ],
    },
  ];
}

// ─── Tree View Module ──────────────────────────────────────────────

export const treeViewModule: ExtensionModule = {
  id: "treeView",
  activate(context) {
    const provider = new BaseTreeDataProvider();
    provider.setRoots(createSampleData());

    const treeView = vscode.window.createTreeView("myExtension.treeView", {
      treeDataProvider: provider,
      showCollapseAll: true,
    });

    context.subscriptions.push(treeView, provider);
    log("Tree view registered");
  },
};
