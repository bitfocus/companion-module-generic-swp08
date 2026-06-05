import { cmds, keepAliveTime } from './consts.js'

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
		// Send a keepalive if the queue is empty
		if (this.queue.size === 0) {
			// Use a real interrogate (destination 1, level 1) as the keepalive.
			// A valid query gets exactly one ACK on every device, unlike an empty
			// message which routers may NAK or ignore.
			const dest = 0 // destination 1 (0-indexed)
			const level = 0 // level 1 (0-indexed)
			if (this.config.extended_support) {
				this.sendMessage([cmds.extendedInterrogate, this.config.matrix - 1, level, dest >> 8, dest & 0xff])
			} else {
				this.sendMessage([
					cmds.crosspointInterrogate,
					((this.config.matrix - 1) << 4) | (level & 0x0f),
					((dest >> 7) & 0x07) << 4, // dest DIV 128
					dest & 0x7f, // dest MOD 128
				])
			}
		}
	}
}
