import { keepAliveTimeOut } from './consts.js'

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
		// biome-ignore lint/performance/noDelete: not really a performance issue
		delete this.keepAliveTimer
	}
}

export function keepAlive() {
	if (this.socket?.isConnected) {
		//Send dummy message
		this.sendMessage([0x00])
	}
	this.startKeepAliveTimer()
}
