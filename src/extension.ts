import * as vscode from 'vscode'

export function activate(context: any) {
  console.log('Congratulations, your extension "vscode-extension" is now active!')
  vscode.window.showInformationMessage('Hello World !')
}
