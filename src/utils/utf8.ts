'use strict';

import {HashZero}                            from '../constants';
import {checkNormalize}                      from '../errors';
import {Arrayish, arrayify, concat, hexlify} from './bytes';

export enum UnicodeNormalizationForm {
	current = '',
	NFC     = 'NFC',
	NFD     = 'NFD',
	NFKC    = 'NFKC',
	NFKD    = 'NFKD'
}

export function toUtf8Bytes(str: string, form: UnicodeNormalizationForm = UnicodeNormalizationForm.current): Uint8Array {
	if (form != UnicodeNormalizationForm.current) {
		checkNormalize();

		str = str.normalize(form);
	}

	let result: any[] = [];
	for (let i = 0; i < str.length; i++) {
		let c = str.charCodeAt(i);

		if (c < 0x80) {
			result.push(c);

		} else if (c < 0x800) {
			// @ts-ignore
			result.push((c >> 6) | 0xc0);
			// @ts-ignore
			result.push((c & 0x3f) | 0x80);

		} else if ((c & 0xfc00) == 0xd800) {
			i++;

			let c2 = str.charCodeAt(i);

			if (i >= str.length || (c2 & 0xfc00) !== 0xdc00) {
				throw new Error('invalid utf-8 string');
			}

			// Surrogate Pair
			c = 0x10000 + ((c & 0x03ff) << 10) + (c2 & 0x03ff);

			result.push((c >> 18) | 0xf0);
			result.push(((c >> 12) & 0x3f) | 0x80);
			result.push(((c >> 6) & 0x3f) | 0x80);
			result.push((c & 0x3f) | 0x80);

		} else {
			result.push((c >> 12) | 0xe0);
			result.push(((c >> 6) & 0x3f) | 0x80);
			result.push((c & 0x3f) | 0x80);
		}
	}

	return arrayify(result);
}

export function toUtf8String(bytes: Arrayish, ignoreErrors?: boolean): string {
	bytes = arrayify(bytes);

	let result = '';
	let i = 0;

	while (i < bytes.length) {
		let c = bytes[i++];
		// 0xxx xxxx
		if (c >> 7 === 0) {
			result += String.fromCharCode(c);

			continue;
		}

		let extraLength: any = null;
		let overlongMask: any = null;

		// 110x xxxx 10xx xxxx
		if ((c & 0xe0) === 0xc0) {
			extraLength = 1;
			overlongMask = 0x7f;

			// 1110 xxxx 10xx xxxx 10xx xxxx
		} else if ((c & 0xf0) === 0xe0) {
			extraLength = 2;
			overlongMask = 0x7ff;

			// 1111 0xxx 10xx xxxx 10xx xxxx 10xx xxxx
		} else if ((c & 0xf8) === 0xf0) {
			extraLength = 3;
			overlongMask = 0xffff;

		} else {
			if (!ignoreErrors) {
				if ((c & 0xc0) === 0x80) {
					throw new Error('invalid utf8 byte sequence; unexpected continuation byte');
				}

				throw new Error('invalid utf8 byte sequence; invalid prefix');
			}

			continue;
		}

		if (i + extraLength > bytes.length) {
			if (!ignoreErrors) { throw new Error('invalid utf8 byte sequence; too short'); }

			for (; i < bytes.length; i++) {
				if (bytes[i] >> 6 !== 0x02) { break; }
			}

			continue;
		}

		let res: any = c & ((1 << (8 - extraLength - 1)) - 1);

		for (let j = 0; j < extraLength; j++) {
			let nextChar = bytes[i];

			if ((nextChar & 0xc0) != 0x80) {
				res = null;

				break;
			}

			res = (res << 6) | (nextChar & 0x3f);
			i++;
		}

		if (res === null) {
			if (!ignoreErrors) { throw new Error('invalid utf8 byte sequence; invalid continuation byte'); }

			continue;
		}

		if (res <= overlongMask) {
			if (!ignoreErrors) { throw new Error('invalid utf8 byte sequence; overlong'); }

			continue;
		}

		if (res > 0x10ffff) {
			if (!ignoreErrors) { throw new Error('invalid utf8 byte sequence; out-of-range'); }

			continue;
		}

		if (res >= 0xd800 && res <= 0xdfff) {
			if (!ignoreErrors) { throw new Error('invalid utf8 byte sequence; utf-16 surrogate'); }

			continue;
		}

		if (res <= 0xffff) {
			result += String.fromCharCode(res);

			continue;
		}

		res -= 0x10000;
		result += String.fromCharCode(((res >> 10) & 0x3ff) + 0xd800, (res & 0x3ff) + 0xdc00);
	}

	return result;
}

export function formatBytes32String(text: string): string {
	let bytes = toUtf8Bytes(text);

	if (bytes.length > 31) { throw new Error('bytes32 string must be less than 32 bytes'); }

	return hexlify(concat([bytes, HashZero]).slice(0, 32));
}

export function parseBytes32String(bytes: Arrayish): string {
	let data = arrayify(bytes);

	if (data.length !== 32) { throw new Error('invalid bytes32 - not 32 bytes long'); }
	if (data[31] !== 0) { throw new Error('invalid bytes32 string - no null terminator'); }

	let length = 31;
	while (data[length - 1] === 0) { length--; }

	return toUtf8String(data.slice(0, length));
}
