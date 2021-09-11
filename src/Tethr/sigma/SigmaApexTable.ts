import {BiMap} from 'bim'

import {BatteryLevel, ExposureMode, ISO, WhiteBalance} from '../Tethr'

export const SigmaApexISO = new BiMap<number, ISO>([
	[0b00000000, 6],
	[0b00000011, 8],
	[0b00000101, 10],
	[0b00001000, 12],
	[0b00001011, 16],
	[0b00001101, 20],
	[0b00010000, 25],
	[0b00010011, 32],
	[0b00010101, 40],
	[0b00011000, 50],
	[0b00011011, 64],
	[0b00011101, 80],
	[0b00100000, 100],
	[0b00100011, 125],
	[0b00100101, 160],
	[0b00101000, 200],
	[0b00101011, 250],
	[0b00101101, 320],
	[0b00110000, 400],
	[0b00110011, 500],
	[0b00110101, 640],
	[0b00111000, 800],
	[0b00111011, 1000],
	[0b00111101, 1250],
	[0b01000000, 1600],
	[0b01000011, 2000],
	[0b01000101, 2500],
	[0b01001000, 3200],
	[0b01001011, 4000],
	[0b01001101, 5000],
	[0b01010000, 6400],
	[0b01010011, 8000],
	[0b01010101, 10000],
	[0b01011000, 12800],
	[0b01011011, 16000],
	[0b01011101, 20000],
	[0b01100000, 25600],
	[0b01100011, 32000],
	[0b01100101, 40000],
	[0b01101000, 51200],
	[0b01101011, 64000],
	[0b01101101, 80000],
	[0b01110000, 102400],
])

export const SigmaApexCompensationOneThird = new BiMap<number, number>([
	[0b00000000, 0.0],
	[0b00000011, 0.3],
	[0b00000101, 0.7],
	[0b00001000, 1.0],
	[0b00001011, 1.3],
	[0b00001110, 1.7],
	[0b00010000, 2.0],
	[0b00010011, 2.3],
	[0b00010101, 2.7],
	[0b00011000, 3.0],
	[0b00011011, 3.3],
	[0b00011101, 3.7],
	[0b00100000, 4.0],
	[0b00100011, 4.3],
	[0b00100101, 4.7],
	[0b00101000, 5.0],
	[0b00101011, 5.3],
	[0b00101101, 5.7],
	[0b00110000, 6.0],
	[0b00110011, 6.3],
])

export const SigmaApexCompensationHalf = new BiMap<number, number>([
	[0b00000000, 0.0],
	[0b00000100, 0.5],
	[0b00001000, 1.0],
	[0b00001100, 1.5],
	[0b00010000, 2.0],
	[0b00010100, 2.5],
	[0b00011000, 3.0],
])

export const SigmaApexShutterSpeedOneThird = new BiMap<number, string>([
	[0b00001000, 'bulb'],
	[0b00010000, '30'],
	[0b00010011, '25'],
	[0b00010101, '20'],
	[0b00011000, '15'],
	[0b00011011, '13'],
	[0b00011101, '10'],
	[0b00100000, '8'],
	[0b00100011, '6'],
	[0b00100101, '5'],
	[0b00101000, '4'],
	[0b00101011, '3.2'],
	[0b00101101, '2.5'],
	[0b00110000, '2'],
	[0b00110011, '1.6'],
	[0b00110101, '1.3'],
	[0b00111000, '1'],
	[0b00111011, '0.8'],
	[0b00111101, '0.6'],
	[0b01000000, '0.5'],
	[0b01000011, '0.4'],
	[0b01000101, '0.3'],
	[0b01001000, '1/4'],
	[0b01001011, '1/5'],
	[0b01001101, '1/6'],
	[0b01010000, '1/8'],
	[0b01010011, '1/10'],
	[0b01010101, '1/13'],
	[0b01011000, '1/15'],
	[0b01011011, '1/20'],
	[0b01011101, '1/25'],
	[0b01100000, '1/30'],
	[0b01100011, '1/40'],
	[0b01100101, '1/50'],
	[0b01101000, '1/60'],
	[0b01101011, '1/80'],
	[0b01101101, '1/100'],
	[0b01110000, '1/125'],
	[0b01110011, '1/160'],
	[0b01110100, '1/180'],
	[0b01110101, '1/200'],
	[0b01111000, '1/250'],
	[0b01111011, '1/320'],
	[0b01111100, '1/350'],
	[0b01111101, '1/400'],
	[0b10000000, '1/500'],
	[0b10000011, '1/640'],
	[0b10000100, '1/750'],
	[0b10000101, '1/800'],
	[0b10001000, '1/1000'],
	[0b10001011, '1/1250'],
	[0b10001100, '1/1500'],
	[0b10001101, '1/1600'],
	[0b10010000, '1/2000'],
	[0b10010011, '1/2500'],
	[0b10010100, '1/3000'],
	[0b10010101, '1/3200'],
	[0b10011000, '1/4000'],
	[0b10011011, '1/5000'],
	[0b10011100, '1/6000'],
	[0b10011101, '1/6000'],
	[0b10100000, '1/8000'],
	[0b10100010, 'sync'],
	[0b10100011, '1/10000'],
	[0b10100101, '1/12800'],
	[0b10101000, '1/16000'],
	[0b10101011, '1/20000'],
	[0b10101101, '1/25600'],
	[0b10110000, '1/32000'],
])

export const SigmaApexShutterSpeedHalf = new BiMap<number, string>([
	[0b00001000, 'bulb'],
	[0b00010001, '30'],
	[0b00010100, '20'],
	[0b00011000, '15'],
	[0b00011100, '10'],
	[0b00100000, '8'],
	[0b00100100, '6'],
	[0b00101000, '4'],
	[0b00101100, '3'],
	[0b00110000, '2'],
	[0b00110100, '1.5'],
	[0b00111000, '1'],
	[0b00111100, '0.7'],
	[0b01000000, '1/2'],
	[0b01000100, '1/3'],
	[0b01001000, '1/4'],
	[0b01001100, '1/6'],
	[0b01010000, '1/8'],
	[0b01010100, '1/10'],
	[0b01011000, '1/15'],
	[0b01011100, '1/20'],
	[0b01100000, '1/30'],
	[0b01100100, '1/45'],
	[0b01101000, '1/60'],
	[0b01101100, '1/90'],
	[0b01110000, '1/125'],
	[0b01111000, '1/250'],
	[0b10000000, '1/500'],
	[0b10001000, '1/1000'],
	[0b10010000, '1/2000'],
	[0b10011000, '1/4000'],
	[0b10100000, '1/8000'],
	[0b10100010, 'sync'],
	[0b10101000, '1/16000'],
	[0b10110000, '1/32000'],
])

export const SigmaApexApertureOneThird = new BiMap<number, number>([
	[0b00001000, 1.0],
	[0b00001011, 1.1],
	[0b00001101, 1.2],
	[0b00010000, 1.4],
	[0b00010011, 1.6],
	[0b00010101, 1.8],
	[0b00011000, 2.0],
	[0b00011011, 2.2],
	[0b00011101, 2.5],
	[0b00100000, 2.8],
	[0b00100011, 3.2],
	[0b00100101, 3.5],
	[0b00101000, 4.0],
	[0b00101011, 4.5],
	[0b00101101, 5.0],
	[0b00110000, 5.6],
	[0b00110011, 6.3],
	[0b00110101, 7.1],
	[0b00111000, 8.0],
	[0b00111011, 9.0],
	[0b00111101, 10],
	[0b01000000, 11],
	[0b01000011, 13],
	[0b01000101, 14],
	[0b01001000, 16],
	[0b01001011, 18],
	[0b01001101, 20],
	[0b01010000, 22],
	[0b01010011, 25],
	[0b01010101, 29],
	[0b01011000, 32],
	[0b01011011, 36],
	[0b01011101, 40],
	[0b01100000, 45],
	[0b01100011, 51],
	[0b01100101, 57],
	[0b01101000, 64],
	[0b01101011, 72],
	[0b01101101, 81],
	[0b01110000, 91],
])

export const SigmaApexApertureHalf = new BiMap<number, number>([
	[0b00001000, 1.0],
	[0b00001100, 1.2],
	[0b00010000, 1.4],
	[0b00010100, 1.8],
	[0b00011000, 2.0],
	[0b00011100, 2.5],
	[0b00100000, 2.8],
	[0b00100100, 3.5],
	[0b00101000, 4.0],
	[0b00101100, 4.5],
	[0b00110000, 5.6],
	[0b00110100, 6.7],
	[0b00111000, 8.0],
	[0b00111100, 9.5],
	[0b01000000, 11],
	[0b01000100, 13],
	[0b01001000, 16],
	[0b01001100, 19],
	[0b01010000, 22],
	[0b01010100, 27],
	[0b01011000, 32],
	[0b01011100, 38],
	[0b01100000, 45],
	[0b01100100, 54],
	[0b01101000, 64],
	[0b01101100, 76],
	[0b01110000, 91],
])

export const SigmaApexExposureMode = new BiMap<number, ExposureMode>([
	[0x1, 'P'],
	[0x2, 'A'],
	[0x3, 'S'],
	[0x4, 'M'],
])

export const SigmaApexBatteryLevel = new Map<number, null | BatteryLevel>([
	[0x00, null],
	[0x01, 1],
	[0x02, 2 / 3],
	[0x03, 1 / 3],
	[0x04, 'low'],
	[0x05, 0],
	[0x06, null],
	[0x07, 0],
	[0x08, 'ac'],
	[0x09, null],
	[0x0a, 4 / 5],
	[0x0b, 3 / 5],
	[0x0c, null],
])

export const SigmaApexWhiteBalance = new BiMap<number, WhiteBalance | 'manual'>(
	[
		[0x01, 'auto'],
		[0x02, 'daylight'], // Sunlight
		[0x03, 'shade'],
		[0x04, 'cloud'], // Overcast
		[0x05, 'incandescent'],
		[0x06, 'florescent'],
		[0x07, 'flash'],
		// [0x08, null], // Custom 1
		// [0x09, null], // CustomCapture 1
		// [0x0a, null], // Custom 2
		// [0x0b, null], // CustomCapture 2
		// [0x0c, null], // Custom 3
		// [0x0d, null], // CustomCapture 3
		[0x0e, 'manual'], // Custom Temperature
		[0x0f, 'auto ambience'], // Auto (Light Source Priority)
	]
)

export const SigmaApexWhiteBalanceIFD = new Map<number, WhiteBalance>([
	[0x1, 'auto'],
	[0x2, 'auto ambience'],
	[0x3, 'daylight'],
	[0x4, 'shade'],
	[0x5, 'tungsten'],
	[0x6, 'florescent'],
	[0x7, 'flash'],
])
