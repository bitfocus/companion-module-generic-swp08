import { combineRgb } from '@companion-module/base'

export const msgDelay = 5

export const DLE = '10'
export const STX = '02'
export const ETX = '03'

export const colours = {
	white: combineRgb(255, 255, 255),
	black: combineRgb(0, 0, 0),
	red: combineRgb(240, 0, 0),
	green: combineRgb(102, 255, 102),
	purple: combineRgb(255, 102, 255),
	cyan: combineRgb(102, 255, 255),
	orange: combineRgb(255, 191, 128)
}
