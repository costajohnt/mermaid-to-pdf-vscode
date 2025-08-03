import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Extension Test Suite', () => {
    const testFixturesDir = path.join(__dirname, '../fixtures');

    test('should be present and activate', async function() {
        const extension = vscode.extensions.getExtension('mermaid-pdf-team.mermaid-to-pdf');
        assert.ok(extension, 'Extension should be present');
        
        await extension?.activate();
        assert.ok(extension?.isActive, 'Extension should be active');
    });

    test('should register convert command', async function() {
        const commands = await vscode.commands.getCommands(true);
        const hasCommand = commands.some(command => command === 'mermaid-to-pdf.convertToPDF');
        assert.ok(hasCommand, 'Extension should register convertToPDF command');
    });

    test('should execute convert command with markdown file', async function() {
        this.timeout(60000);
        
        const testFile = path.join(testFixturesDir, 'simple.md');
        const document = await vscode.workspace.openTextDocument(testFile);
        await vscode.window.showTextDocument(document);
        
        await vscode.commands.executeCommand('mermaid-to-pdf.convertToPDF', vscode.Uri.file(testFile));
        
        const expectedPdfPath = path.join(path.dirname(testFile), 'simple_final.pdf');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        assert.ok(fs.existsSync(expectedPdfPath), 'PDF should be created');
        
        if (fs.existsSync(expectedPdfPath)) {
            fs.unlinkSync(expectedPdfPath);
        }
    });
});