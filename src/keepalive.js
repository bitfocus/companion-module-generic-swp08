import { keepAliveTime } from './consts.js'

export function startKeepAliveTimer() {
	if (this.keepAliveTimer) {
		clearInterval(this.keepAliveTimer)
	}
	this.keepAliveTimer = setInterval(() => {
		this.keepAlive()
	}, keepAliveTime)
}

export function stopKeepAliveTimer() {
	if (this.keepAliveTimer) {
		clearInterval(this.keepAliveTimer)
		// biome-ignore lint/performance/noDelete: not really a performance issue
		delete this.keepAliveTimer
	}
}

export function keepAlive() {
	if (this.socket?.isConnected) {
		// Send dummy message if the queue is empty
		if (this.queue.size === 0) {
			this.sendMessage([])
		}
	}
}
