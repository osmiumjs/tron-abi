export const UNKNOWN_ERROR = 'UNKNOWN_ERROR';
export const NOT_IMPLEMENTED = 'NOT_IMPLEMENTED';
export const MISSING_NEW = 'MISSING_NEW';
export const CALL_EXCEPTION = 'CALL_EXCEPTION';
export const INVALID_ARGUMENT = 'INVALID_ARGUMENT';
export const MISSING_ARGUMENT = 'MISSING_ARGUMENT';
export const UNEXPECTED_ARGUMENT = 'UNEXPECTED_ARGUMENT';
export const NUMERIC_FAULT = 'NUMERIC_FAULT';
export const INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS';
export const NONCE_EXPIRED = 'NONCE_EXPIRED';
export const REPLACEMENT_UNDERPRICED = 'REPLACEMENT_UNDERPRICED';
export const UNSUPPORTED_OPERATION = 'UNSUPPORTED_OPERATION';

let _permanentCensorErrors = false;
let _censorErrors = false;

export function throwError(message: string, code: string, params: any): never {
	if (_censorErrors) {
		throw new Error('unknown error');
	}

	if (!code) { code = UNKNOWN_ERROR; }
	if (!params) { params = {}; }

	let messageDetails: Array<string> = [];

	Object.keys(params).forEach((key) => {
		try {
			messageDetails.push(`${key}=${JSON.stringify(params[key])}`);
		} catch (error) {
			messageDetails.push(`${key}=${JSON.stringify(params[key].toString())}`);
		}
	});

	messageDetails.push('version=0.1.0');

	let reason = message;
	if (messageDetails.length) {
		message += ` (${messageDetails.join(', ')})`;
	}

	let error: any = new Error(message);
	error.reason = reason;
	error.code = code;

	Object.keys(params).forEach(function (key) {
		error[key] = params[key];
	});

	throw error;
}

export function checkNew(self: any, kind: any): void {
	if (!(self instanceof kind)) {
		throwError('missing new', MISSING_NEW, {name: kind.name});
	}
}

export function checkArgumentCount(count: number, expectedCount: number, suffix?: string): void {
	if (!suffix) { suffix = ''; }

	if (count < expectedCount) {
		throwError('missing argument' + suffix, MISSING_ARGUMENT, {count: count, expectedCount: expectedCount});
	}

	if (count > expectedCount) {
		throwError('too many arguments' + suffix, UNEXPECTED_ARGUMENT, {count: count, expectedCount: expectedCount});
	}
}

export function setCensorship(censorship: boolean, permanent?: boolean): void {
	if (_permanentCensorErrors) {
		throwError('error censorship permanent', UNSUPPORTED_OPERATION, {operation: 'setCensorship'});
	}

	_censorErrors = !!censorship;
	_permanentCensorErrors = !!permanent;
}

export function checkNormalize(): void {
	try {
		// Make sure all forms of normalization are supported
		['NFD', 'NFC', 'NFKD', 'NFKC'].forEach((form) => {
			try {
				'test'.normalize(form);
			} catch (error) {
				throw new Error('missing ' + form);
			}
		});

		if (String.fromCharCode(0xe9).normalize('NFD') !== String.fromCharCode(0x65, 0x0301)) {
			throw new Error('broken implementation');
		}

	} catch (error) {
		// @ts-ignore
		throwError('platform missing String.prototype.normalize', UNSUPPORTED_OPERATION, {operation: 'String.prototype.normalize', form: error.message});
	}
}

const LogLevels: { [name: string]: number } = {debug: 1, 'default': 2, info: 2, warn: 3, error: 4, off: 5};
let LogLevel = LogLevels['default'];

export function setLogLevel(logLevel: string): void {
	let level = LogLevels[logLevel];

	if (level == null) {
		warn('invliad log level - ' + logLevel);
		return;
	}

	LogLevel = level;
}

function log(logLevel: string, args: Array<any>): void {
	if (LogLevel > LogLevels[logLevel]) { return; }

	console.log.apply(console, args);
}

export function warn(...args: Array<any>): void {
	log('warn', args);
}

export function info(...args: Array<any>): void {
	log('info', args);
}
