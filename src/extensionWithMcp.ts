import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FinalMermaidToPdfConverter } from './finalConverter';
import { createMcpClient, MermaidToPdfMcpClient } from './mcpClient';

let mcpClient: MermaidToPdfMcpClient | null = null;

export function activate(context: vscode.ExtensionContext) {
    console.log('Mermaid to PDF extension is now active!');

    // Check if MCP mode is enabled
    const config = vscode.workspace.getConfiguration('mermaidToPdf');
    const useMcpServer = config.get<boolean>('useMcpServer', false);

    // Local converter instance
    const localConverter = new FinalMermaidToPdfConverter({
        engine: 'puppeteer',
        quality: 'high',
        theme: 'light',
        pageSize: 'A4'
    });

    // Register the main conversion command
    let disposable = vscode.commands.registerCommand('mermaid-to-pdf.convertToPDF', async (uri: vscode.Uri) => {
        let fileUri: vscode.Uri | undefined = uri;
        
        if (!fileUri) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor && activeEditor.document.languageId === 'markdown') {
                fileUri = activeEditor.document.uri;
            } else {
                vscode.window.showErrorMessage('Please open a Markdown file or select one in the explorer');
                return;
            }
        }

        if (!fileUri.fsPath.endsWith('.md')) {
            vscode.window.showErrorMessage('Please select a Markdown file');
            return;
        }

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Converting Markdown to PDF${useMcpServer ? ' (via MCP)' : ''}`,
                cancellable: false
            }, async (progress) => {
                let outputPath: string;

                if (useMcpServer) {
                    // Use MCP server
                    outputPath = await convertWithMcp(fileUri!.fsPath, progress);
                } else {
                    // Use local converter
                    outputPath = await convertLocally(fileUri!.fsPath, localConverter, progress);
                }
                
                vscode.window.showInformationMessage(`PDF created: ${outputPath}`);
                
                const openPdf = await vscode.window.showInformationMessage(
                    'PDF created successfully!',
                    'Open PDF',
                    'Show in Explorer'
                );
                
                if (openPdf === 'Open PDF') {
                    vscode.env.openExternal(vscode.Uri.file(outputPath));
                } else if (openPdf === 'Show in Explorer') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(outputPath));
                }
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to convert: ${error}`);
        }
    });

    // Register command to toggle MCP mode
    let toggleMcp = vscode.commands.registerCommand('mermaid-to-pdf.toggleMcpMode', async () => {
        const config = vscode.workspace.getConfiguration('mermaidToPdf');
        const currentValue = config.get<boolean>('useMcpServer', false);
        await config.update('useMcpServer', !currentValue, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage(
            `Mermaid to PDF: ${!currentValue ? 'MCP Server mode enabled' : 'Local mode enabled'}`
        );
    });

    // Register command to check MCP status
    let checkStatus = vscode.commands.registerCommand('mermaid-to-pdf.checkMcpStatus', async () => {
        if (mcpClient) {
            vscode.window.showInformationMessage('MCP server is connected and ready');
        } else {
            const useMcp = vscode.workspace.getConfiguration('mermaidToPdf').get<boolean>('useMcpServer', false);
            if (useMcp) {
                vscode.window.showWarningMessage('MCP mode is enabled but server is not connected');
            } else {
                vscode.window.showInformationMessage('Using local conversion mode');
            }
        }
    });

    context.subscriptions.push(disposable, toggleMcp, checkStatus);
}

async function convertWithMcp(
    filePath: string, 
    progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<string> {
    progress.report({ increment: 10, message: "Connecting to MCP server..." });
    
    // Initialize MCP client if needed
    if (!mcpClient) {
        try {
            mcpClient = await createMcpClient();
        } catch (error) {
            throw new Error(`Failed to connect to MCP server: ${error}`);
        }
    }

    progress.report({ increment: 20, message: "Sending file to MCP server..." });
    
    const result = await mcpClient.convertFileToFile(filePath);
    
    if (!result.success) {
        throw new Error(result.error || 'MCP conversion failed');
    }
    
    progress.report({ increment: 100, message: "Complete!" });
    
    return result.outputPath!;
}

async function convertLocally(
    filePath: string,
    converter: FinalMermaidToPdfConverter,
    progress: vscode.Progress<{ message?: string; increment?: number }>
): Promise<string> {
    return await converter.convert(filePath, (message: string, increment: number) => {
        progress.report({ increment, message });
    });
}

export function deactivate() {
    // Cleanup MCP client if connected
    if (mcpClient) {
        mcpClient.disconnect().catch(console.error);
    }
}