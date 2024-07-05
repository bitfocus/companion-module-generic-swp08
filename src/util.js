import { Buffer } from 'node:buffer'

export function stripNumber(str) {
	let n = str.indexOf(':')
	if (n > 0) {
		return str.slice(n + 2)
	} else {
		return str
	}
}

export function padLeft(nr, n, str) {
	return Array(n - String(nr).length + 1).join(str || '0') + nr
}

export function asciiToHex(str) {
	let arr1 = []
	for (let n = 0, l = str.length; n < l; n++) {
		let hex = Number(str.charCodeAt(n)).toString(16)
		arr1.push(hex)
	}
	return arr1.join('')
}

export function hexStringToBuffer(str) {
	return Buffer.from(str, 'hex')
}

export function getLength(str) {
	let length = (str.length / 2).toString(16)
	return this.padLeft(length, 4)
}

export function checksum8(N) {
	// convert input value to upper case
	let strN = new String(N)
	strN = strN.toUpperCase()

	let strHex = new String('0123456789ABCDEF')
	let result = 0
	let fctr = 16

	for (let i = 0; i < strN.length; i++) {
		if (strN.charAt(i) == ' ') continue

		let v = strHex.indexOf(strN.charAt(i))
		if (v < 0) {
			result = -1
			break
		}

		result += v * fctr

		if (fctr == 16) fctr = 1
		else fctr = 16
	}

	// Calculate 2's complement
	result = (~(result & 0xff) + 1) & 0xff

	// Convert result to string
	const strResult = strHex.charAt(Math.floor(result / 16)) + strHex.charAt(result % 16)

	// console.log('checksum: ' + strResult)
	return strResult
}
