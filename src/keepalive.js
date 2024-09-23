import { DLE, STX, ETX, keepAliveTimeOut } from './consts.js'

export function startKeepAliveTimer() {
	if (this.keepAliveTimer) {
		clearTimeout(this.keepAliveTimer)
	}
	this.keepAliveTimer = setTimeout(() => {
		this.keepAlive()
	}, keepAliveTimeOut)
}

export function stopKeepAliveTimer() {
	if (this.keepAliveTimer) {
		clearTimeout(this.keepAliveTimer)
		delete this.keepAliveTimer
	}
}

export function keepAlive() {
	if (this.socket !== undefined && this.socket.isConnected) {
		//Send dummy message
		this.socket.send(this.hexStringToBuffer(DLE + STX + '0000' + DLE + ETX))
	}
	this.startKeepAliveTimer()
}
