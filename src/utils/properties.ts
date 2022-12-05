'use strict';

import * as errors from '../errors';

export function defineReadOnly(object: any, name: string, value: any): void {
	Object.defineProperty(object, name, {
		enumerable: true,
		value     : value,
		writable  : false,
	});
}

export function setType(object: any, type: string): void {
	Object.defineProperty(object, '_ethersType', {configurable: false, value: type, writable: false});
}

export function isType(object: any, type: string): boolean {
	return (object && object._ethersType === type);
}

export function resolveProperties(object: any): Promise<any> {
	let result: any = {};

	let promises: Array<Promise<void>> = [];
	Object.keys(object).forEach((key) => {
		let value = object[key];
		if (value instanceof Promise) {
			promises.push(
				// @ts-ignore
				value.then((value) => {
					result[key] = value;
					return null;
				})
			);
		} else {
			result[key] = value;
		}
	});

	return Promise.all(promises).then(() => {
		return result;
	});
}

export function checkProperties(object: any, properties: { [name: string]: boolean }): void {
	if (!object || typeof (object) !== 'object') {
		errors.throwError('invalid object', errors.INVALID_ARGUMENT, {
			argument: 'object',
			value   : object
		});
	}

	Object.keys(object).forEach((key) => {
		if (!properties[key]) {
			errors.throwError('invalid object key - ' + key, errors.INVALID_ARGUMENT, {
				argument: 'transaction',
				value   : object,
				key     : key
			});
		}
	});
}

export function shallowCopy(object: any): any {
	let result: any = {};
	for (let key in object) { result[key] = object[key]; }
	return result;
}

let opaque: { [key: string]: boolean } = {boolean: true, number: true, string: true};

export function deepCopy(object: any, frozen?: boolean): any {
	// Opaque objects are not mutable, so safe to copy by assignment
	if (object === undefined || object === null || opaque[typeof (object)]) { return object; }

	if (Array.isArray(object)) {
		let result = object.map((item) => deepCopy(item, frozen));
		if (frozen) { Object.freeze(result); }

		return result;
	}

	if (typeof (object) === 'object') {
		if (isType(object, 'BigNumber')) { return object; }
		if (isType(object, 'Description')) { return object; }
		if (isType(object, 'Indexed')) { return object; }

		let result: { [key: string]: any } = {};

		for (let key in object) {
			let value = object[key];

			if (value === undefined) { continue; }

			defineReadOnly(result, key, deepCopy(value, frozen));
		}

		if (frozen) { Object.freeze(result); }

		return result;
	}

	if (typeof (object) === 'function') {
		return object;
	}

	throw new Error('Cannot deepCopy ' + typeof (object));
}

function inherits(ctor: any, superCtor: any): void {
	ctor.super_ = superCtor;

	ctor.prototype = Object.create(superCtor.prototype, {
		constructor: {
			value       : ctor,
			enumerable  : false,
			writable    : true,
			configurable: true
		}
	});
}

export function inheritable(parent: any): (child: any) => void {
	return function (child: any): void {
		inherits(child, parent);

		defineReadOnly(child, 'inherits', inheritable(child));
	};
}