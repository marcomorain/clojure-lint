// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as cp from 'child_process';


function lint(fileName: string, options: cp.ExecOptions): Promise<string> {
	const command = "clj-kondo --config '{:output {:format :json}}' --lint " + fileName;
	return new Promise<string>((resolve, reject) => {
		cp.exec(command, options, (error, stdout, stderr) => {
			if (!error || error.code === 2 || error.code === 3) {
				resolve(stdout);
			} else {
				reject({ error, stdout, stderr });
			}
		});
	});
}

interface Finding {
	type: string;
	filename: string;
	row: number;
	col: number;
	level: string;
	message: string;
}

interface Results {
	findings: Finding[];
	summary: {
		error: number,
		warning: number,
		type: "summary",
		duration: number
	};
}

function severity(level: string): vscode.DiagnosticSeverity {
	switch (level) {
		case "error": return vscode.DiagnosticSeverity.Error;
	}
	return vscode.DiagnosticSeverity.Error;
}

function range(finding: Finding): vscode.Range {
	return new vscode.Range(
		finding.row - 1, finding.col,
		finding.row - 1, finding.col);
}

function toDiagnostic(finding: Finding): vscode.Diagnostic {
	return {
		message: finding.message,
		severity: severity(finding.level),
		range: range(finding)
	};
}

async function callback(channel: vscode.OutputChannel, diagnostics: vscode.DiagnosticCollection) {
	const ed = vscode.window.activeTextEditor;

	if (!ed) {
		return;
	}

	const doc = ed.document;

	if (!doc) {
		return;
	}

	const file = doc.fileName;

	try {
		const stdout = await lint(file, {
			//cwd: workspaceRoot
		});

		const errors: Results = JSON.parse(stdout);
		diagnostics.set(doc.uri, errors.findings.map(toDiagnostic));
		channel.append(stdout);

	} catch (err) {
		channel.appendLine("exec error");
		channel.appendLine(err);
		console.log(err);
		diagnostics.delete(doc.uri);
	}

	vscode.window.showInformationMessage('Hello World!');
}


// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "clojure-lint" is now active!');

	let diagnostics = vscode.languages.createDiagnosticCollection('clojure');

	context.subscriptions.push(diagnostics);

	const channel = vscode.window.createOutputChannel('Clojure Lint');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('extension.helloWorld', () => {
		callback(channel, diagnostics);
	});

	context.subscriptions.push(disposable);


}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log("foo");
}
