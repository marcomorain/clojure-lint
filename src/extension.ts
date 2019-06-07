import * as vscode from 'vscode';
import { exec } from 'child_process';

function lint(fileName: string): Promise<string> {
	const command = "clj-kondo --config '{:output {:format :json}}' --lint " + fileName;
	return new Promise<string>((resolve, reject) => {
		exec(command, {}, (error, stdout, stderr) => {
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
		case "warning": return vscode.DiagnosticSeverity.Warning;
		// TODO: more cases
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

async function listener(channel: vscode.OutputChannel, diagnostics: vscode.DiagnosticCollection) {

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
		const stdout = await lint(file);

		const errors: Results = JSON.parse(stdout);
		diagnostics.set(doc.uri, errors.findings.map(toDiagnostic));
		channel.appendLine(String(errors.summary));

	} catch (err) {
		channel.appendLine("exec error");
		channel.appendLine(err);
		diagnostics.delete(doc.uri);
	}
}

export function activate(context: vscode.ExtensionContext) {

	console.log("Marc running");

	const channel = vscode.window.createOutputChannel('Clojure Lint');

	channel.appendLine("Extension loaded");

	let diagnostics = vscode.languages.createDiagnosticCollection('clojure');

	context.subscriptions.push(diagnostics);

	vscode.workspace.onDidSaveTextDocument(() => {
		listener(channel, diagnostics);
	});

	channel.appendLine("Extension running");
}

// this method is called when your extension is deactivated
export function deactivate() {
	console.log("foo");
}
