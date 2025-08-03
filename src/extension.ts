import * as vscode from 'vscode';
import { FinalMermaidToPdfConverter } from './finalConverter';

export function activate(context: vscode.ExtensionContext) {
    console.log('Mermaid to PDF extension is now active!');

    const converter = new FinalMermaidToPdfConverter({
        engine: 'puppeteer',
        quality: 'high',
        theme: 'light',
        pageSize: 'A4'
    });

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
                title: "Converting Markdown to PDF",
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 0, message: "Reading Markdown file..." });
                
                const outputPath = await converter.convert(fileUri!.fsPath, (message: string, increment: number) => {
                    progress.report({ increment, message });
                });
                
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

    context.subscriptions.push(disposable);
}

export function deactivate() {}