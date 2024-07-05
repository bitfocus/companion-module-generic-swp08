const keepAliveTimeOut = 30000

export function startKeepAliveTimer(){
    if (this.keepAliveTimer) {
		clearTimeout(this.keepAliveTimer)
	}
    this.keepAliveTimer = setTimeout(() => {
		this.keepAlive()
	}, keepAliveTimeOut)
}

export function stopKeepAliveTimer(){
    if (this.keepAliveTimer) {
        clearTimeout(this.keepAliveTimer)
        delete this.keepAliveTimer
    }
}

export function keepAlive(){
    //this.sendMessage('61019E') what message to send here?
}
