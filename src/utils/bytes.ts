import * as errors from '../errors';

export type Arrayish = string | ArrayLike<number>;

export interface Hexable {
	toHexString(): string;
}

export interface Signature {
	r: string;
	s: string;
	recoveryParam?: number;
	v?: number;
}

export function isHexable(value: any): value is Hexable {
	return !!(value.toHexString);
}

function addSlice(array: Uint8Array): Uint8Array {
	return array;
}

export function isArrayish(value: any): value is Arrayish {
	if (!value || parseInt(String(value.length)) != value.length || typeof (value) === 'string') {
		return false;
	}

	for (const element of value) {
		let v = element;

		if (v < 0 || v >= 256 || parseInt(String(v)) != v) {
			return false;
		}
	}

	return true;
}

export function arrayify(value: Arrayish | Hexable): Uint8Array {
	if (value == null) {
		errors.throwError('cannot convert null value to array', errors.INVALID_ARGUMENT, {arg: 'value', value: value});
	}

	if (isHexable(value)) {
		value = value.toHexString();
	}

	if (typeof (value) === 'string') {
		let match = value.match(/^(0x)?[0-9a-fA-F]*$/);

		if (!match) {
			errors.throwError('invalid hexidecimal string', errors.INVALID_ARGUMENT, {arg: 'value', value: value});
		}

		if (match[1] !== '0x') {
			errors.throwError('hex string must have 0x prefix', errors.INVALID_ARGUMENT, {arg: 'value', value: value});
		}

		value = value.substring(2);
		if (value.length % 2) { value = `0${value}`; }

		let result = [];
		for (let i = 0; i < value.length; i += 2) {
			// @ts-ignore
			result.push(parseInt(value.substr(i, 2), 16));
		}

		return addSlice(new Uint8Array(result));
	}

	if (isArrayish(value)) {
		return addSlice(new Uint8Array(value));
	}


	// @ts-ignore
	errors.throwError('invalid arrayify value', null, {arg: 'value', value: value, type: typeof (value)});
	// @ts-ignore
	return null;
}

export function concat(objects: Array<Arrayish>): Uint8Array {
	let arrays = [];
	let length = 0;

	for (const element of objects) {
		let object = arrayify(element);
		// @ts-ignore

		arrays.push(object);
		length += object.length;
	}

	let result = new Uint8Array(length);
	let offset = 0;

	for (const element of arrays) {
		result.set(element, offset);
		// @ts-ignore
		offset += element.length;
	}

	return addSlice(result);
}

export function stripZeros(value: Arrayish): Uint8Array {
	let result: Uint8Array = arrayify(value);

	if (result.length === 0) { return result; }

	// Find the first non-zero entry
	let start = 0;
	while (result[start] === 0) { start++; }

	// If we started with zeros, strip them
	if (start) {
		result = result.slice(start);
	}

	return result;
}

export function padZeros(value: Arrayish, length: number): Uint8Array {
	value = arrayify(value);

	if (length < value.length) { throw new Error('cannot pad'); }

	let result = new Uint8Array(length);
	result.set(value, length - value.length);

	return addSlice(result);
}


export function isHexString(value: any, length?: number): boolean {
	if (typeof (value) !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/)) {
		return false;
	}

	if (length && value.length !== 2 + 2 * length) { return false; }

	return true;
}

const HexCharacters: string = '0123456789abcdef';

export function hexlify(value: Arrayish | Hexable | number): string {
	if (isHexable(value)) {
		return value.toHexString();
	}

	if (typeof (value) === 'number') {
		if (value < 0) {
			errors.throwError('cannot hexlify negative value', errors.INVALID_ARGUMENT, {arg: 'value', value: value});
		}

		if (value >= 9007199254740991) {
			errors.throwError('out-of-range', errors.NUMERIC_FAULT, {
				operartion: 'hexlify',
				fault     : 'out-of-safe-range'
			});
		}

		let hex = '';
		while (value) {
			hex = HexCharacters[value & 0x0f] + hex;
			value = Math.floor(value / 16);
		}

		if (hex.length) {
			if (hex.length % 2) { hex = `0${hex}`; }
			return `0x${hex}`;
		}

		return '0x00';
	}

	if (typeof (value) === 'string') {
		let match = value.match(/^(0x)?[0-9a-fA-F]*$/);

		if (!match) {
			errors.throwError('invalid hexidecimal string', errors.INVALID_ARGUMENT, {arg: 'value', value: value});
		}

		if (match[1] !== '0x') {
			errors.throwError('hex string must have 0x prefix', errors.INVALID_ARGUMENT, {arg: 'value', value: value});
		}

		if (value.length % 2) {
			value = `0x0${value.substring(2)}`;
		}

		return value;
	}

	if (isArrayish(value)) {
		const result = [];
		for (let i = 0; i < value.length; i++) {
			let v = value[i];
			// @ts-ignore
			result.push(HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f]);
		}
		return '0x' + result.join('');
	}

	// @ts-ignore
	errors.throwError('invalid hexlify value', null, {arg: 'value', value: value});

	return 'never';
}

export function hexDataLength(data: string) {
	if (!isHexString(data) || (data.length % 2) !== 0) {
		return null;
	}

	return (data.length - 2) / 2;
}

export function hexDataSlice(data: string, offset: number, endOffset?: number): string {
	if (!isHexString(data)) {
		errors.throwError('invalid hex data', errors.INVALID_ARGUMENT, {arg: 'value', value: data});
	}

	if ((data.length % 2) !== 0) {
		errors.throwError('hex data length must be even', errors.INVALID_ARGUMENT, {arg: 'value', value: data});
	}

	offset = 2 + 2 * offset;

	if (endOffset != null) {
		return `0x${data.substring(offset, 2 + 2 * endOffset)}`;
	}

	return `0x${data.substring(offset)}`;
}

export function hexStripZeros(value: string): string {
	if (!isHexString(value)) {
		errors.throwError('invalid hex string', errors.INVALID_ARGUMENT, {arg: 'value', value: value});
	}

	while (value.length > 3 && value.substring(0, 3) === '0x0') {
		value = `0x${value.substring(3)}`;
	}

	return value;
}

export function hexZeroPad(value: string, length: number): string {
	if (!isHexString(value)) {
		errors.throwError('invalid hex string', errors.INVALID_ARGUMENT, {arg: 'value', value: value});
	}

	while (value.length < 2 * length + 2) {
		value = '0x0' + value.substring(2);
	}

	return value;
}

function isSignature(value: any): value is Signature {
	return (value && value.r != null && value.s != null);
}

export function splitSignature(signature: Arrayish | Signature): Signature {
	let v = 0;
	let r = '0x',
	    s = '0x';

	if (isSignature(signature)) {
		if (signature.v == null && signature.recoveryParam == null) {
			errors.throwError('at least on of recoveryParam or v must be specified', errors.INVALID_ARGUMENT, {argument: 'signature', value: signature});
		}

		r = hexZeroPad(signature.r, 32);
		s = hexZeroPad(signature.s, 32);

		// @ts-ignore
		v = signature.v;

		if (typeof (v) === 'string') { v = parseInt(v, 16); }

		let recoveryParam = signature.recoveryParam;
		if (recoveryParam == null && signature.v != null) {
			recoveryParam = 1 - (v % 2);
		}

		// @ts-ignore
		v = 27 + recoveryParam;

	} else {
		let bytes: Uint8Array = arrayify(signature);

		if (bytes.length !== 65) {
			throw new Error('invalid signature');
		}

		r = hexlify(bytes.slice(0, 32));
		s = hexlify(bytes.slice(32, 64));

		v = bytes[64];

		if (v !== 27 && v !== 28) {
			v = 27 + (v % 2);
		}
	}

	return {
		r            : r,
		s            : s,
		recoveryParam: (v - 27),
		v            : v
	};
}

export function joinSignature(signature: Signature): string {
	signature = splitSignature(signature);

	return hexlify(concat([
		signature.r,
		signature.s,
		(signature.recoveryParam ? '0x1c' : '0x1b')
	]));
}