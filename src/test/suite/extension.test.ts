import * as assert from "assert";
import * as vscode from "vscode";

suite("Extension Test Suite", () => {
  test("Extension should be present", () => {
    const ext = vscode.extensions.getExtension("your-publisher-id.my-vscode-extension");
    assert.ok(ext);
  });

  test("Should activate without errors", async () => {
    const ext = vscode.extensions.getExtension("your-publisher-id.my-vscode-extension");
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    assert.ok(ext?.isActive);
  });

  test("Should register commands", async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes("myExtension.helloWorld"));
    assert.ok(commands.includes("myExtension.showPanel"));
  });

  test("Hello World command should show message", async () => {
    // This tests that the command executes without throwing.
    await vscode.commands.executeCommand("myExtension.helloWorld");
  });
});
