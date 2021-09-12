import _ from 'lodash'
import sleep from 'sleep-promise'

import {decodeIFD, IFDType} from '../../IFD'
import {ResCode} from '../../PTPDatacode'
import {PTPDecoder} from '../../PTPDecoder'
import {isntNil} from '../../util'
import {
	Aperture,
	BasePropType,
	BatteryLevel,
	ExposureMode,
	ISO,
	PropDesc,
	SetPropResult,
	SetPropResultStatus,
	Tethr,
	WhiteBalance,
} from '../Tethr'
import {
	SigmaApexApertureHalf,
	SigmaApexApertureOneThird,
	SigmaApexBatteryLevel,
	SigmaApexExposureMode,
	SigmaApexISO,
	SigmaApexShutterSpeedHalf,
	SigmaApexShutterSpeedOneThird,
	SigmaApexWhiteBalance,
	SigmaApexWhiteBalanceIFD,
} from './SigmaApexTable'

enum OpCodeSigma {
	GetCamConfig = 0x9010,
	GetCamStatus = 0x9011,
	GetCamDataGroup1 = 0x9012,
	GetCamDataGroup2 = 0x9013,
	GetCamDataGroup3 = 0x9014,
	GetCamCaptStatus = 0x9015,
	SetCamDataGroup1 = 0x9016,
	SetCamDataGroup2 = 0x9017,
	SetCamDataGroup3 = 0x9018,
	SetCamClockAdj = 0x9019,
	GetCamCanSetInfo = 0x901a,
	SnapCommand = 0x901b,
	ClearImageDBSingle = 0x901c,
	ClearImageDBAll = 0x901d,
	GetPictFileInfo = 0x9020,
	GetPartialPictFile = 0x9021,
	GetBigPartialPictFile = 0x9022,

	GetCamDataGroup4 = 0x9023, // ver1.1
	SetCamDataGroup4 = 0x9024, // ver1.1
	GetCamCanSetInfo2 = 0x9025, // ver1.1

	GetCamCanSetInfo3 = 0x9026, // ver1.2
	GetCamDataGroup5 = 0x9027, // ver1.2
	SetCamDataGroup5 = 0x9028, // ver1.2
	GetCamDataGroup6 = 0x9029, // ver1.2
	SetCamDataGroup6 = 0x902a, // ver1.2

	GetViewFrame = 0x902b, // V21
	GetCamCanSetInfo4 = 0x902e, // V21

	GetCamStatus2 = 0x902c,
	GetPictFileInfo2 = 0x902d,
	CloseApplication = 0x902f, // V21

	GetCamCanSetInfo5 = 0x9030, // V5
	GetCamDataGroupFocus = 0x9031, // V5
	SetCamDataGroupFocus = 0x9032, // V5
	GetCamDataGroupMovie = 0x9033, // V5
	SetCamDataGroupMovie = 0x9034, // V5
	ConfigApi = 0x9035, // V5
	GetMovieFileInfo = 0x9036, // V5
	GetPartialMovieFile = 0x9037, // V5
}

enum CaptStatus {
	runSnap = 0x0001,
	compSnap = 0x0002,
	runImageCreate = 0x0004,
	compImageCreate = 0x0005,
	compMovieStopStandby = 0x0006,
	compMovieCreate = 0x0007,
	okAf = 0x8001,
	okCwb = 0x8002,
	okImageSave = 0x8003,
	okNoerrorEtc = 0x8004,
	ngAf = 0x6001,
	ngBaffaFull = 0x6002,
	ngCwb = 0x6003,
	ngImageCreate = 0x6004,
	ngGeneral = 0x6005,
}

export class TethrSigma extends Tethr {
	private _liveviewing = false

	public open = async (): Promise<void> => {
		await super.open()

		await this.device.receiveData({
			label: 'SigmaFP ConfigApi',
			code: OpCodeSigma.ConfigApi,
			parameters: [0x0],
		})

		await this.getCamDataGroup1()
		await this.getCamDataGroup2()
	}

	public async set<K extends keyof BasePropType>(
		name: K,
		value: BasePropType[K]
	): Promise<SetPropResult<BasePropType[K]>> {
		let succeed = false
		let status: SetPropResultStatus | undefined
		switch (name) {
			case 'exposureMode':
				succeed = await this.setExposureMode(value as ExposureMode)
				break
			case 'aperture':
				succeed = await this.setAperture(value as Aperture)
				break
			case 'shutterSpeed':
				succeed = await this.setShutterSpeed(value as string)
				break
			case 'iso':
				succeed = await this.setISO(value as ISO)
				break
			case 'whiteBalance':
				succeed = await this.setWhiteBalance(value as WhiteBalance)
				break
			case 'colorTemperature':
				succeed = await this.setColorTemperature(value as number)
				break
			default:
				status = 'unsupported'
		}

		const postValue = await this.get(name)

		return {
			status: status ?? (succeed ? 'ok' : 'invalid'),
			value: postValue,
		}
	}

	public async getDesc<K extends keyof BasePropType, T extends BasePropType[K]>(
		name: K
	): Promise<PropDesc<T>> {
		switch (name) {
			case 'batteryLevel':
				return (await this.getBatteryLevelDesc()) as PropDesc<T>
			case 'focalLength':
				return (await this.getFocalLengthDesc()) as PropDesc<T>
			case 'exposureMode':
				return (await this.getExposureModeDesc()) as PropDesc<T>
			case 'aperture':
				return (await this.getApertureDesc()) as PropDesc<T>
			case 'shutterSpeed':
				return (await this.getShutterSpeedDesc()) as PropDesc<T>
			case 'iso':
				return (await this.getISODesc()) as PropDesc<T>
			case 'whiteBalance':
				return (await this.getWhiteBalanceDesc()) as PropDesc<T>
			case 'colorTemperature':
				return (await this.getColorTemperatureDesc()) as PropDesc<T>
		}

		return {
			writable: false,
			value: null,
			supportedValues: [],
		}
	}

	private getFocalLengthDesc = async (): Promise<PropDesc<number>> => {
		const data = (await this.getCamDataGroup1()).currentLensFocalLength
		const value = this.decodeFocalLength(data)

		return {
			writable: false,
			value,
			supportedValues: [],
		}
	}

	private getAperture = async () => {
		const {aperture} = await this.getCamDataGroup1()
		if (aperture === 0x0) return 'auto'
		return (
			SigmaApexApertureOneThird.get(aperture) ??
			SigmaApexApertureHalf.get(aperture) ??
			null
		)
	}

	private setAperture = async (aperture: Aperture): Promise<boolean> => {
		if (aperture === 'auto') return false

		const byte = SigmaApexApertureOneThird.getKey(aperture)
		if (!byte) return false

		return await this.setCamData(OpCodeSigma.SetCamDataGroup1, 1, byte)
	}

	private getApertureDesc = async (): Promise<PropDesc<Aperture>> => {
		const fValue = (await this.getCamCanSetInfo5()).fValue
		const value = await this.getAperture()

		if (fValue.length === 0) {
			// Should be auto aperture
			return {
				writable: false,
				value,
				supportedValues: [],
			}
		}

		const [svMin, svMax, step] = fValue

		const isStepOneThird = Math.abs(step - 1 / 3) < Math.abs(step - 1 / 2)
		const table = isStepOneThird
			? SigmaApexApertureOneThird
			: SigmaApexApertureHalf

		const apertures = Array.from(table.values())

		const fMinRaw = Math.sqrt(2 ** svMin)
		const fMaxRaw = Math.sqrt(2 ** svMax)

		const fMin = _.minBy(apertures, a => Math.abs(a - fMinRaw))
		const fMax = _.minBy(apertures, a => Math.abs(a - fMaxRaw))

		if (!fMin || !fMax) throw new Error()

		const supportedValues = apertures.filter(a => fMin <= a && a <= fMax)

		return {
			writable: true,
			value,
			supportedValues,
		}
	}

	private getShutterSpeed = async () => {
		const {shutterSpeed} = await this.getCamDataGroup1()
		if (shutterSpeed === 0x0) return 'auto'
		return (
			SigmaApexShutterSpeedOneThird.get(shutterSpeed) ??
			SigmaApexShutterSpeedHalf.get(shutterSpeed) ??
			null
		)
	}

	private getShutterSpeedDesc = async (): Promise<PropDesc<string>> => {
		const range = (await this.getCamCanSetInfo5()).shutterSpeed
		const value = await this.getShutterSpeed()

		if (range.length < 3) {
			return {
				writable: false,
				value,
				supportedValues: [],
			}
		}

		const [tvMin, tvMax, step] = range

		const isStepOneThird = Math.abs(step - 1 / 3) < Math.abs(step - 1 / 2)
		const table = isStepOneThird
			? SigmaApexShutterSpeedOneThird
			: SigmaApexShutterSpeedHalf

		const shutterSpeeds = Array.from(table.entries()).filter(
			e => e[1] !== 'sync' && e[1] !== 'bulb'
		)

		const ssMinRaw = 1 / 2 ** tvMin
		const ssMaxRaw = 1 / 2 ** tvMax

		const ssMinEntry = _.minBy(shutterSpeeds, e =>
			Math.abs(convertSSToTime(e[1]) - ssMinRaw)
		)
		const ssMaxEntry = _.minBy(shutterSpeeds, e =>
			Math.abs(convertSSToTime(e[1]) - ssMaxRaw)
		)

		if (!ssMinEntry || !ssMaxEntry) throw new Error()

		const ssMinIndex = ssMinEntry[0]
		const ssMaxIndex = ssMaxEntry[0]

		const supportedValues = shutterSpeeds
			.filter(e => ssMinIndex <= e[0] && e[0] <= ssMaxIndex)
			.map(e => e[1])

		return {
			writable: supportedValues.length > 0,
			value,
			supportedValues,
		}

		function convertSSToTime(ss: string) {
			if (ss === 'bulk' || ss === 'sync') return Infinity
			if (ss.startsWith('1/')) return 1 / parseInt(ss.slice(2))
			return parseFloat(ss)
		}
	}

	private setShutterSpeed = async (shutterSpeed: string): Promise<boolean> => {
		const byte = SigmaApexShutterSpeedOneThird.getKey(shutterSpeed)
		if (!byte) return false

		return this.setCamData(OpCodeSigma.SetCamDataGroup1, 0, byte)
	}

	private getISO = async () => {
		const {isoAuto, isoSpeed} = await this.getCamDataGroup1()
		if (isoAuto === 0x01) {
			return 'auto'
		} else {
			return SigmaApexISO.get(isoSpeed) ?? null
		}
	}

	private setISO = async (iso: ISO): Promise<boolean> => {
		if (iso === 'auto') {
			return await this.setCamData(OpCodeSigma.SetCamDataGroup1, 3, 0x1)
		}

		const byte = SigmaApexISO.getKey(iso)
		if (!byte) return false

		return (
			(await this.setCamData(OpCodeSigma.SetCamDataGroup1, 3, 0x0)) &&
			(await this.setCamData(OpCodeSigma.SetCamDataGroup1, 4, byte))
		)
	}

	private getISODesc = async (): Promise<PropDesc<ISO>> => {
		const {isoManual} = await this.getCamCanSetInfo5()
		const value = await this.getISO()

		const [svMin, svMax] = isoManual

		const isoMin = Math.round(3.125 * 2 ** svMin)
		const isoMax = Math.round(3.125 * 2 ** svMax)

		const isos = [...SigmaApexISO.values()]
		const supportedValues = isos.filter(a => isoMin <= a && a <= isoMax)

		supportedValues.unshift('auto')

		return {
			writable: true,
			value,
			supportedValues,
		}
	}

	private getWhiteBalance = async () => {
		const {whiteBalance} = await this.getCamDataGroup2()
		return SigmaApexWhiteBalance.get(whiteBalance) ?? null
	}

	private setWhiteBalance = async (wb: WhiteBalance): Promise<boolean> => {
		const byte = SigmaApexWhiteBalance.getKey(wb)
		if (!byte) return false
		return await this.setCamData(OpCodeSigma.SetCamDataGroup2, 13, byte)
	}

	private getWhiteBalanceDesc = async (): Promise<PropDesc<WhiteBalance>> => {
		const {whiteBalance} = await this.getCamCanSetInfo5()
		const value = await this.getWhiteBalance()

		const supportedValues = whiteBalance
			.map(v => SigmaApexWhiteBalanceIFD.get(v))
			.filter(isntNil)

		return {
			writable: supportedValues.length > 0,
			value,
			supportedValues,
		}
	}

	private getColorTemperature = async () => {
		const wb = await this.getWhiteBalance()
		if (wb !== 'manual') return null

		const {colorTemperature} = await this.getCamDataGroup5()
		return colorTemperature
	}

	private setColorTemperature = async (value: number) => {
		return (
			(await this.setCamData(OpCodeSigma.SetCamDataGroup2, 13, 0x0e)) &&
			(await this.setCamData(OpCodeSigma.SetCamDataGroup5, 1, value))
		)
	}

	private getColorTemperatureDesc = async () => {
		const {colorTemerature} = await this.getCamCanSetInfo5()
		const value = await this.getColorTemperature()

		if (colorTemerature.length !== 3) {
			// When WB is not set to 'manual'
			return {
				writable: false,
				value,
			}
		}

		const [min, max, step] = colorTemerature

		return {
			writable: true,
			value,
			supportedValues: _.range(min, max, step),
		}
	}

	private getExposureMode = async () => {
		const {exposureMode} = await this.getCamDataGroup2()
		return SigmaApexExposureMode.get(exposureMode) ?? null
	}

	private setExposureMode = async (
		exposureMode: ExposureMode
	): Promise<boolean> => {
		const byte = SigmaApexExposureMode.getKey(exposureMode)
		if (!byte) return false

		return this.setCamData(OpCodeSigma.SetCamDataGroup2, 2, byte)
	}

	private getExposureModeDesc = async (): Promise<PropDesc<ExposureMode>> => {
		const {exposureMode} = await this.getCamCanSetInfo5()
		const value = await this.getExposureMode()

		const supportedValues = exposureMode
			.map(n => SigmaApexExposureMode.get(n))
			.filter(m => m !== undefined) as ExposureMode[]

		return {
			writable: supportedValues.length > 0,
			value,
			supportedValues,
		}
	}

	private getExposureComp = async () => {
		const {expCompensation} = await this.getCamDataGroup1()

		return expCompensation.toString(2)
	}

	private setExposureComp = async (value: string): Promise<boolean> => {
		return this.setCamData(OpCodeSigma.SetCamDataGroup1, 5, value)
	}

	private getExposureCompDesc = async (): Promise<PropDesc<string>> => {
		const {exposureComp} = await this.getCamCanSetInfo5()
		const value = await this.getExposureComp()

		if (exposureComp.length < 3) {
			return {
				writable: false,
				value,
				supportedValues: [],
			}
		}

		const [min, max, step] = exposureComp

		return {
			writable: exposureComp.length > 0,
			value,
			supportedValues,
		}
	}

	private getBatteryLevelDesc = async (): Promise<PropDesc<BatteryLevel>> => {
		const {batteryLevel} = await this.getCamDataGroup1()
		const value = SigmaApexBatteryLevel.get(batteryLevel) ?? null

		return {
			writable: false,
			value,
			supportedValues: [],
		}
	}

	public takePicture = async (): Promise<null | string> => {
		const {imageDBTail: id} = await this.getCamCaptStatus()

		console.log({id})

		// Snap
		const buffer = new ArrayBuffer(2)
		const dataView = new DataView(buffer)

		dataView.setUint8(0, 0x02)
		dataView.setUint8(1, 0x02)

		await this.device.sendData({
			label: 'SigmaFP SnapCommand',
			code: 0x901b,
			data: this.encodeParameter(buffer),
		})

		try {
			let tries = 50
			while (tries--) {
				const {status} = await this.getCamCaptStatus(id)

				switch (status) {
					case CaptStatus.ngAf:
						throw new Error('AF failure')
					case CaptStatus.ngBaffaFull:
						throw new Error('Buffer full')
					case CaptStatus.ngCwb:
						throw new Error('Custom WB failure')
					case CaptStatus.ngImageCreate:
						throw new Error('Image generation failed')
					case CaptStatus.ngGeneral:
						throw new Error('Capture failed')
				}

				if (status === CaptStatus.compImageCreate) break

				await sleep(500)
			}
			if (tries === 0) throw new Error('Timeout')

			const {data: pictInfoData} = await this.device.receiveData({
				label: 'SigmaFP GetPictFileInfo2',
				code: 0x902d,
			})
			const pictInfo = this.decodePictureFileInfoData2(pictInfoData)

			// Get file
			const {data: pictFileData} = await this.device.receiveData({
				label: 'SigmaFP GetBigPartialPictFile',
				code: OpCodeSigma.GetBigPartialPictFile,
				parameters: [pictInfo.fileAddress, 0x0, pictInfo.fileSize],
			})

			// Generate Blob URL and return it
			const blob = new Blob([pictFileData.slice(4)], {type: 'image/jpeg'})
			const url = window.URL.createObjectURL(blob)
			return url
		} finally {
			await this.device.sendData({
				label: 'SigmaFP ClearImageDBSingle',
				code: OpCodeSigma.ClearImageDBSingle,
				parameters: [id],
				data: new ArrayBuffer(8),
			})
		}
	}

	public runAutoFocus = async (): Promise<boolean> => {
		const {imageDBTail: id} = await this.getCamCaptStatus()

		// Snap
		const buffer = new ArrayBuffer(2)
		const dataView = new DataView(buffer)

		dataView.setUint8(0, 0x04)
		dataView.setUint8(1, 0x01)

		await this.device.sendData({
			label: 'SigmaFP SnapCommand',
			code: 0x901b,
			data: this.encodeParameter(buffer),
		})

		let tries = 50
		while (tries--) {
			const {status} = await this.getCamCaptStatus(id)

			// Failure
			if ((status & 0xf000) === 0x6000) return false
			// Success
			if (status === CaptStatus.okAf) break

			await sleep(500)
		}

		await this.device.sendData({
			label: 'SigmaFP ClearImageDBSingle',
			code: OpCodeSigma.ClearImageDBSingle,
			parameters: [id],
			data: new ArrayBuffer(8),
		})

		return true
	}

	public startLiveView = async (): Promise<void> => {
		this._liveviewing = true
	}

	public stopLiveView = async (): Promise<void> => {
		this._liveviewing = false
	}

	public getLiveView = async (): Promise<null | string> => {
		const {code, data} = await this.device.receiveData({
			label: 'SigmaFP GetViewFrame',
			code: OpCodeSigma.GetViewFrame,
			parameters: [],
			expectedResCodes: [ResCode.OK, ResCode.DeviceBusy],
		})

		if (code !== ResCode.OK) return null

		// Might be quirky but somehow works
		const jpegData = data.slice(10)

		const blob = new Blob([jpegData], {type: 'image/jpg'})
		const url = window.URL.createObjectURL(blob)
		return url
	}

	public get liveviewing(): boolean {
		return this._liveviewing
	}

	private async getCamDataGroup1() {
		const {data} = await this.device.receiveData({
			label: 'SigmaFP GetCamDataGroup1',
			code: OpCodeSigma.GetCamDataGroup1,
			parameters: [0x0],
		})

		const decoder = new PTPDecoder(data)
		decoder.skip(3) // OC + FieldPreset

		return {
			shutterSpeed: decoder.readUint8(),
			aperture: decoder.readUint8(),
			programShift: decoder.readInt8(),
			isoAuto: decoder.readUint8(),
			isoSpeed: decoder.readUint8(),
			expCompensation: decoder.readUint8(),
			abValue: decoder.readUint8(),
			abSettings: decoder.readUint8(),
			frameBufferState: decoder.readUint8(),
			mediaFreeSpace: decoder.readUint16(),
			mediaStatus: decoder.readUint8(),
			currentLensFocalLength: decoder.readUint16(),
			batteryLevel: decoder.readUint8(),
			abShotRemainNumber: decoder.readUint8(),
			expCompExcludeAB: decoder.readUint8(),
		}
	}

	private async getCamDataGroup2() {
		const {data} = await this.device.receiveData({
			label: 'SigmaFP GetCamDataGroup2',
			code: OpCodeSigma.GetCamDataGroup2,
			parameters: [0x0],
		})

		const decoder = new PTPDecoder(data)
		decoder.skip(3) // OC + FieldPreset

		return {
			driveMode: decoder.readUint8(),
			specialMode: decoder.readUint8(),
			exposureMode: decoder.readUint8(),
			aeMeteringMode: decoder.readUint8(),
			whiteBalance: decoder.goto(3 + 10).readUint8(),
			resolution: decoder.readUint8(),
			imageQuality: decoder.readUint8(),
		}
	}

	private async getCamDataGroup5() {
		const {data} = await this.device.receiveData({
			label: 'SigmaFP GetCamDataGroup5',
			code: OpCodeSigma.GetCamDataGroup5,
			parameters: [0x0],
		})

		const decoder = new PTPDecoder(data)
		decoder.skip(3) // OC + FieldPreset

		return {
			intervalTimerSecond: decoder.readUint16(),
			intervalTimerFame: decoder.readUint8(),
			intervalTimerSecond_Remain: decoder.readUint16(),
			intervalTimerFrame_Remain: decoder.readUint8(),
			colorTemperature: decoder.readUint16(),
			aspectRatio: decoder.skip(2).readUint8(),
		}
	}

	private async getCamCanSetInfo5() {
		const {data} = await this.device.receiveData({
			label: 'SigmaFP GetCamCanSetInfo5',
			code: OpCodeSigma.GetCamCanSetInfo5,
			parameters: [0x0],
		})

		return decodeIFD(data, {
			exposureMode: {tag: 200, type: IFDType.Byte},
			fValue: {tag: 210, type: IFDType.SignedShort},
			shutterSpeed: {tag: 212, type: IFDType.SignedShort},
			isoManual: {tag: 215, type: IFDType.SignedShort},
			exposureComp: {tag: 217, type: IFDType.SignedShort},
			whiteBalance: {tag: 301, type: IFDType.Byte},
			colorTemerature: {tag: 302, type: IFDType.Short},
		})
	}

	private async getCamDataGroupFocus() {
		const {data} = await this.device.receiveData({
			label: 'SigmaFP GetCamDataGroupFocus',
			code: OpCodeSigma.GetCamDataGroupFocus,
			parameters: [0x0],
		})

		return decodeIFD(data, {
			focusMode: {tag: 1, type: IFDType.Byte},
			afLock: {tag: 2, type: IFDType.Byte},
			afFaceEyePriorMode: {tag: 3, type: IFDType.Byte},
			afFaceEyePriorDetectionStatus: {tag: 4, type: IFDType.Byte},
			afAreaSelect: {tag: 10, type: IFDType.Byte},
			afAreaMode: {tag: 11, type: IFDType.Byte},
			afFrameSize: {tag: 12, type: IFDType.Byte},
			// afFramePosition: {tag: 13, type: IFDType.Byte},
			// afFrameFaceFocusDetection: {tag: 14, type: IFDType.Byte},
			preAlwaysAf: {tag: 51, type: IFDType.Byte},
			afLimit: {tag: 52, type: IFDType.Byte},
		})
	}

	private async setCamData(code: number, propNumber: number, value: number) {
		const buffer = new ArrayBuffer(4)
		const dataView = new DataView(buffer)

		dataView.setUint16(0, 1 << propNumber, true)
		dataView.setUint16(2, value, true)

		const data = this.encodeParameter(buffer)

		try {
			await this.device.sendData({
				label: 'SigmaFP SetCamDataGroup#',
				code,
				data,
			})
		} catch (err) {
			return false
		}

		return true
	}

	private async getCamCaptStatus(id = 0) {
		const {data} = await this.device.receiveData({
			label: 'SigmaFP GetCamCaptStatus',
			code: OpCodeSigma.GetCamCaptStatus,
			parameters: [id],
		})

		const decoder = new PTPDecoder(data.slice(1))

		return {
			imageId: decoder.readUint8(),
			imageDBHead: decoder.readUint8(),
			imageDBTail: decoder.readUint8(),
			status: decoder.readUint16(),
			destination: decoder.readUint8(),
		}
	}

	private decodePictureFileInfoData2(data: ArrayBuffer) {
		const decoder = new PTPDecoder(data)

		decoder.skip(12)

		return {
			fileAddress: decoder.readUint32(),
			fileSize: decoder.readUint32(),
			fileExt: decoder.skip(8).readByteString(),
			resolution: {
				width: decoder.readUint16(),
				height: decoder.readUint16(),
			},
			folderName: decoder.readByteString(),
			fileName: decoder.readByteString(),
		}
	}

	private decodeFocalLength(byte: number) {
		const integer = byte >> 4,
			fractional = byte & 0b1111

		return integer + fractional / 10
	}

	private encodeParameter(buffer: ArrayBuffer) {
		const bytes = new Uint8Array(buffer)

		const size = buffer.byteLength
		const encodedBuffer = new ArrayBuffer(size + 2)
		const encodedBytes = new Uint8Array(encodedBuffer)

		// Set size at the first byte
		encodedBytes[0] = size

		// Insert the content
		for (let i = 0; i < size; i++) {
			encodedBytes[1 + i] = bytes[i]
		}

		// Add checksum on the last
		let checksum = 0
		for (let i = 0; i <= size; i++) {
			checksum += encodedBytes[i]
		}
		encodedBytes[size + 1] = checksum

		return encodedBuffer
	}
}
