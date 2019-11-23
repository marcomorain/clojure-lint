import { execFile } from 'child_process';
import { inspect } from 'util';
import { dirname } from 'path';
import { which }  from 'shelljs';
import * as vscode from 'vscode';

const welcome =
	`Clojure Lint extension loaded.
Please report any issues to https://github.com/marcomorain/clojure-lint/issues`;

const install =
	`clj-kondo was not found on the path. Please install it following the instructions
located here: https://github.com/borkdude/clj-kondo/blob/master/doc/install.md"`;

const bug =
	`An unexpected error occured when running clj-kondo. Please report a bug
to https://github.com/marcomorain/clojure-lint/issues`;

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
	workingDir: string,
	onSuccess: OnSuccess,
	needInstall: NeedInstall,
	otherProblem: OtherProblem) {

	const command = which('clj-kondo');

	if (!command) {
		return needInstall();
	}

	const args = [ '--config', '{:output {:format :json}}', '--lint', fileName];
	execFile(command.toString(), args, { cwd: workingDir }, (err, stdout, _stderr) => {

		// error can be an `ExecException` or an `Error`.
		// In those cases, code is a string or a number, depending on the type.
		let error = err as any;

		// Kondo exits with 2 or 3 if there were findings.
		if (!error || error.code === 2 || error.code === 3) {
			try {
				const results: Results = JSON.parse(stdout);
				return onSuccess(results);
			} catch (error) {
				return otherProblem(error);
			}
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
		case "info": return vscode.DiagnosticSeverity.Information;
	}
	return vscode.DiagnosticSeverity.Information;
}

function range(finding: Finding): vscode.Range {
	// clj-kondo can report errors on line 0 col 0 when there is an unexpected
	// error linting.
	let row = Math.max(0, finding.row - 1);
	return new vscode.Range(row, finding.col, row, finding.col);
}

function toDiagnostic(finding: Finding): vscode.Diagnostic {
	return {
		message: finding.message,
		severity: severity(finding.level),
		range: range(finding)
	};
}

function workspaceDirectory(doc: vscode.TextDocument): string {
	const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
	if (folder) {
		return folder.uri.fsPath;
	}
	return dirname(doc.uri.fsPath);
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

	const { languageId, fileName } = doc;

	if (languageId !== 'clojure') {
		return;
	}

	const workingDir = workspaceDirectory(doc);

	lint(fileName,
		workingDir,
		(results) => {
			diagnostics.set(doc.uri, results.findings.map(toDiagnostic));
			channel.appendLine(`Linted ${fileName}: ${results.summary.error} errors, ${results.summary.warning} warnings`);
		},
		needInstall,
		(error) => {
			channel.appendLine(bug);
			channel.appendLine(inspect(error));
			diagnostics.delete(doc.uri);
			channel.show(true);
		});
}

export function activate(context: vscode.ExtensionContext) {
	const channel = vscode.window.createOutputChannel('Clojure Lint');
	channel.appendLine(welcome);

	let diagnostics = vscode.languages.createDiagnosticCollection('clojure');
	context.subscriptions.push(diagnostics);

	// If clj-kondo cannot be found, we only want to warn the user once.
	// Use a promise, which can only be resolved once to get a functional method
	// to only call a function once.
	let showInstallMessage = new Promise(function (resolve, _reject) {
		vscode.workspace.onDidSaveTextDocument(() => {
			listener(channel, diagnostics, resolve);
		});
	}).then(() => {
		channel.appendLine(install);
		channel.show(true);
	});
}

export function deactivate() {
	console.log("clojure-lint deactivated");
}
