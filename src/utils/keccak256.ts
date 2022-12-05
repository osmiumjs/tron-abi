import sha3 = require('js-sha3');

import {arrayify, Arrayish} from './bytes';

export function keccak256(data: Arrayish): string {
	return `0x${sha3.keccak_256(arrayify(data))}`;
}
