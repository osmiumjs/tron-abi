import {iterateSync} from '@osmium/iterate';
import {Buffer}      from 'buffer';
import {AbiCoder}    from './utils/abi-coder';
import {keccak256}   from './utils/keccak256';

const ADDRESS_PREFIX = '41';

interface SmartContract_ABI_Entry_Param {
	indexed: boolean;
	name: string;
	type: string; // SolidityType type = 3;
}

export enum SmartContract_ABI_Entry_EntryType {
	UnknownEntryType = 0,
	Constructor      = 1,
	Function         = 2,
	Event            = 3,
	Fallback         = 4,
	Receive          = 5,
	Error            = 6
}

export enum SmartContract_ABI_Entry_StateMutabilityType {
	UnknownMutabilityType = 0,
	Pure                  = 1,
	View                  = 2,
	Nonpayable            = 3,
	Payable               = 4
}

interface SmartContract_ABI_Entry {
	anonymous: boolean;
	constant: boolean;
	name: string;
	inputs: SmartContract_ABI_Entry_Param[];
	outputs: SmartContract_ABI_Entry_Param[];
	type: SmartContract_ABI_Entry_EntryType;
	payable: boolean;
	stateMutability: SmartContract_ABI_Entry_StateMutabilityType;
}

function _handleInputs(input) {
	let tupleArray = false;
	if (input instanceof Object && input.components) {
		input = input.components;
		tupleArray = true;
	}

	if (!Array.isArray(input)) {
		if (input instanceof Object && input.type) {
			return input.type;
		}

		return input;
	}

	let ret = '(' + input.reduce((acc, x) => {
		if (x.type === 'tuple') {
			acc.push(_handleInputs(x.components));
		} else if (x.type === 'tuple[]') {
			acc.push(_handleInputs(x.components) + '[]');
		} else {
			acc.push(x.type);
		}
		return acc;
	}, []).join(',') + ')';

	if (tupleArray) {
		return ret + '[]';
	}
}

function genMethodId(methodName, types) {
	const input = methodName + '(' + (types.reduce((acc, x) => {
		acc.push(_handleInputs(x));
		return acc;
	}, []).join(',')) + ')';

	return keccak256(Buffer.from(input)).slice(2, 10);
}

export function decodeTronParams(types: string[], args: string[], input: string): { [key: string]: any } {
	const abiCoder = new AbiCoder();

	if (input.replace(/^0x/, '').length % 64) {
		throw new Error('The encoded string is not valid. Its length must be a multiple of 64.');
	}

	return abiCoder.decode(types, `0x${input}`).reduce((obj, arg, index) => {
		if (types[index] === 'address') {
			arg = ADDRESS_PREFIX + arg.substr(2).toLowerCase();
		}

		obj.push(arg);

		return obj;
	}, []);
}

export function decodeTronABI(data: Uint8Array, keys: string[], methodName: string, abi: SmartContract_ABI_Entry[]): { [key: string]: any } | null {
	const dataBuf = Buffer.from(data);
	const bufMethod = dataBuf.subarray(0, 4);
	const hexData = dataBuf.subarray(4).toString('hex');

	const methodId = Array.from(
		bufMethod,
		(byte: number) => (`0${(byte & 0xFF).toString(16)}`).slice(-2)
	).join('');

	// @ts-ignore
	const results = abi.reduce((acc, obj) => {
		switch (obj.type) {
			case SmartContract_ABI_Entry_EntryType.Constructor:
			case SmartContract_ABI_Entry_EntryType.Event:
				return acc;

			default:
				break;
		}

		const method = obj.name;

		let typesInput = obj.inputs ? obj.inputs.map(x => x.type === 'tuple[]' ? x : x.type) : [];
		let namesInput = obj.inputs ? obj.inputs.map(x => x.type === 'tuple[]' ? '' : x.name) : [];

		const hash = genMethodId(method, typesInput);

		if (hash === methodId && method === methodName) {
			const inputs = decodeTronParams(typesInput as any, keys, hexData);

			return {
				method,
				typesInput,
				namesInput,
				inputs
			};
		}

		return acc;
	}, {method: '', inputs: [], typesInput: [], namesInput: []});

	if (!results.inputs.length) return null;

	return iterateSync(results.inputs, (row, idx, iter) => {
		iter.key(keys[idx]);

		// @ts-ignore
		switch (results.typesInput[idx]) {
			case 'address':
				return row;

			case 'uint256':
				return row.toString();

			default:
				return row;
		}
		// @ts-ignore
	}, {});
}