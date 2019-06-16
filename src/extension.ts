import { inspect } from 'util';
import * as vscode from 'vscode';
import { execFile } from 'child_process';

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

type OnSuccess = (results: Results) => void;
type NeedInstall = () => void;
type OtherProblem = (error: Error) => void;

function lint(fileName: string,
	onSuccess: OnSuccess,
	needInstall: NeedInstall,
	otherProblem: OtherProblem) {

	const command = 'clj-kondo';
	const args = [
		'--config',
		'{:output {:format :json}}',
		'--lint',
		fileName];

	execFile(command, args, {}, (err, stdout, _stderr) => {

		// error can be an `ExecException` or an `Error`.
		// In those cases, code is a string or a number, depending on the type.
		let error = err as any;

		// Kondo exits with 2 or 3 if there were findings.
		if (!error || error.code === 2 || error.code === 3) {
			const results: Results = JSON.parse(stdout);
			return onSuccess(results);
		}

		if (error.code === "ENOENT") {
			return needInstall();
		}

		return otherProblem(error);
	});
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

async function listener(channel: vscode.OutputChannel,
	diagnostics: vscode.DiagnosticCollection,
	needInstall: () => void) {

	const ed = vscode.window.activeTextEditor;

	if (!ed) {
		return;
	}

	const doc = ed.document;

	if (!doc) {
		return;
	}

	const file = doc.fileName;

	lint(file,
		(results) => {
			diagnostics.set(doc.uri, results.findings.map(toDiagnostic));
			channel.appendLine('Linted ' + file + ': ' + results.summary.error + ' errors, ' + results.summary.warning + ' warnings');
		},
		needInstall,
		(error) => {
			channel.appendLine("Unknown error runnign clj-kondo. Please report a bug.");
			channel.appendLine(inspect(error));
			diagnostics.delete(doc.uri);
			channel.show(true);
		});
}


export function activate(context: vscode.ExtensionContext) {
	const channel = vscode.window.createOutputChannel('Clojure Lint');
	channel.appendLine("Extension loaded");
	let diagnostics = vscode.languages.createDiagnosticCollection('clojure');
	context.subscriptions.push(diagnostics);

	// If clj-kondo cannt be found, we only want to warn the user once.
	// Use a promise, which can only be resolved once to get a functional method
	// to only call a function once.
	let showInstallMessage = new Promise(function (resolve, _reject) {
		vscode.workspace.onDidSaveTextDocument(() => {
			listener(channel, diagnostics, resolve);
		});
		channel.appendLine("Extension running");
	}).then(() => {
		channel.appendLine("clj-kondo was not found. Please install it.");
		channel.appendLine("https://github.com/borkdude/clj-kondo/blob/master/doc/install.md");
		channel.show(true);
	});
}

export function deactivate() {
	console.log("clojure-lint deactivated");
}
