import {DeviceInfo} from '@/DeviceInfo'
import {ObjectInfo} from '@/ObjectInfo'

import {DevicePropCode, OpCode, ResCode} from '../PTPDatacode'
import {PTPDecoder} from '../PTPDecoder'
import {PTPDevice} from '../PTPDevice'
import {
	PTPAccessCapability,
	PTPFilesystemType,
	PTPStorageType,
} from '../PTPEnum'

export type Aperture = 'auto' | number

export type ISO = 'auto' | number

export type WhiteBalance =
	| 'auto'
	| 'auto cool'
	| 'auto warm'
	| 'auto ambience'
	| 'daylight'
	| 'shade'
	| 'cloud'
	| 'incandescent'
	| 'florescent'
	| 'tungsten'
	| 'flash'
	| 'manual'

export type BatteryLevel = 'ac' | 'low' | number

export type FunctionalMode = 'standard' | 'sleep'

export type FocusMode = 'af' | 'mf'

export type FlashMode =
	| 'auto'
	| 'off'
	| 'fill'
	| 'red eye auto'
	| 'red eye fill'
	| 'external sync'

export type ExposureMode = 'P' | 'A' | 'S' | 'M'

export type ExposureMeteringMode =
	| 'average'
	| 'center-weighted-average'
	| 'multi-spot'
	| 'center-spot'

export type StillCaptureMode = 'normal' | 'burst' | 'timelapse'

export type EffectMode = 'standard' | 'bw' | 'sepia' | string

export type FocusMeteringMode = 'center-spot' | 'multi-spot'

export interface DevicePropDesc<T> {
	currentValue: T
	factoryDefaultValue: T
	getSet: number
	range?: {
		min: T
		max: T
		step: T
	}
}

export type PropDesc<T> = {
	canRead: boolean
	canWrite: boolean
	range: T[]
}

interface BasePropType {
	batteryLevel: BatteryLevel
	functionalMode: FunctionalMode
	imageSize: [number, number]
	compressionSetting: 0x5004
	whiteBalance: WhiteBalance
	rgbGain: [number, number, number]
	colorTemperature: number // Added
	aperture: number // fNumber
	focalLength: number
	focusDistance: number
	focusMode: FocusMode
	exposureMeteringMode: ExposureMeteringMode
	flashMode: FlashMode
	// exposureTime: number
	shutterSpeed: string
	exposureMode: ExposureMode // exposureProgramMode
	// exposureIndex: 0x500f
	exposureCompensation: number // exposureBiasCompensation
	dateTime: Date
	captureDelay: number
	stillCaptureMode: StillCaptureMode
	contrast: number
	sharpness: number
	digitalZoom: number
	effectMode: EffectMode
	burstNumber: number
	burstInterval: number
	timelapseNumber: number
	timelapseInterval: number
	focusMeteringMode: FocusMeteringMode
	uploadURL: string
	artist: string
	copyrightInfo: string
	iso: ISO // added
}

export class Tethr<PropType extends {[name: string]: any} = BasePropType> {
	protected _opened = false

	public constructor(protected device: PTPDevice) {}

	public get opened(): boolean {
		return this._opened
	}

	public async open(): Promise<void> {
		if (!this.device.opened) {
			await this.device.open()
		}

		await this.device.sendCommand({
			label: 'Open Session',
			code: OpCode.OpenSession,
			parameters: [0x1],
			expectedResCodes: [ResCode.OK, ResCode.SessionAlreadyOpen],
		})

		this._opened = true
	}

	public close = async (): Promise<void> => {
		this._opened = false

		await this.device.sendCommand({
			label: 'Close Session',
			code: OpCode.CloseSession,
		})
		await this.device.close()
	}

	public getDeviceInfo = async (): Promise<DeviceInfo> => {
		return await Tethr.getDeviceInfo(this.device)
	}

	public getStorageInfo = async (): Promise<void> => {
		const {data} = await this.device.receiveData({
			label: 'Get Storage IDs',
			code: OpCode.GetStorageIDs,
		})
		const decoder = new PTPDecoder(data)

		const storageIDs = decoder.getUint32Array()
		console.log('Storage IDs =', storageIDs)

		for (const id of storageIDs) {
			const {data} = await this.device.receiveData({
				label: 'GetStorageInfo',
				parameters: [id],
				code: OpCode.GetStorageInfo,
			})

			const storageInfo = new PTPDecoder(data)

			const info = {
				storageType: PTPStorageType[storageInfo.getUint16()],
				filesystemType: PTPFilesystemType[storageInfo.getUint16()],
				accessCapability: PTPAccessCapability[storageInfo.getUint16()],
				maxCapability: storageInfo.getUint64(),
				freeSpaceInBytes: storageInfo.getUint64(),
				freeSpaceInImages: storageInfo.getUint32(),
			}

			console.log(`Storage info for ${id}=`, info)
		}
	}

	public async getProp<K extends keyof PropType>(
		name: K
	): Promise<null | PropType[K]>
	public async getProp(name: string): Promise<null | any> {
		return null
	}

	public async setProp<K extends keyof PropType>(
		name: K,
		value: PropType[K]
	): Promise<boolean>
	public async setProp(name: string, value: any): Promise<boolean> {
		return false
	}

	public async getPropDesc<K extends keyof PropType>(
		name: K
	): Promise<PropDesc<PropType[K]>>
	public async getPropDesc(name: string): Promise<PropDesc<any>> {
		return {
			canRead: false,
			canWrite: false,
			range: [],
		}
	}

	public getFocalLength = async (): Promise<null | number> => null

	public getExposureMode = async (): Promise<null | ExposureMode> => null

	public setExposureMode = async (
		exposureMode: ExposureMode
	): Promise<boolean> => false

	public getExposureModeDesc = async (): Promise<PropDesc<ExposureMode>> => {
		return {
			canRead: false,
			canWrite: false,
			range: [],
		}
	}

	public getAperture = async (): Promise<null | Aperture> => null

	public setAperture = async (aperture: Aperture): Promise<boolean> => false

	public getApertureDesc = async (): Promise<PropDesc<Aperture>> => {
		return {
			canRead: false,
			canWrite: false,
			range: [],
		}
	}

	public getShutterSpeed = async (): Promise<null | string> => null

	public setShutterSpeed = async (shutterSpeed: string): Promise<boolean> =>
		false

	public getShutterSpeedDesc = async (): Promise<PropDesc<string>> => {
		return {
			canRead: false,
			canWrite: false,
			range: [],
		}
	}

	public getISO = async (): Promise<null | ISO> => null

	public setISO = async (iso: ISO): Promise<boolean> => false

	public getISODesc = async (): Promise<PropDesc<ISO>> => {
		return {
			canRead: false,
			canWrite: false,
			range: [],
		}
	}

	public getWhiteBalance = async (): Promise<null | WhiteBalance> => null

	public setWhiteBalance = async (wb: WhiteBalance): Promise<boolean> => false

	public getWhiteBalanceDesc = async (): Promise<PropDesc<WhiteBalance>> => {
		return {
			canRead: false,
			canWrite: false,
			range: [],
		}
	}

	public getColorTemperature = async (): Promise<null | number> => null

	public setColorTemperature = async (value: number): Promise<boolean> => false

	public getColorTemperatureDesc = async (): Promise<PropDesc<number>> => {
		return {
			canRead: false,
			canWrite: false,
			range: [],
		}
	}

	public getBatteryLevel = async (): Promise<null | BatteryLevel> => {
		const desc = await this.getDevicePropDesc(DevicePropCode.BatteryLevel)

		if (!desc) return null

		const min = desc.range?.min ?? 0
		const max = desc.range?.max ?? 100
		const value = desc.currentValue

		return (value - min) / (max - min)
	}

	public runAutoFocus = async (): Promise<boolean> => false

	public takePicture = async (): Promise<null | string> => null

	public startLiveView = async (): Promise<void> => {
		return
	}

	public stopLiveView = async (): Promise<void> => {
		return
	}

	public getLiveView = async (): Promise<null | string> => {
		console.info('Liveview is not supported for the current camera')
		return null
	}

	public get liveviewing(): boolean {
		return false
	}

	public getDevicePropDesc = async (
		deviceProp: number
	): Promise<null | DevicePropDesc<number>> => {
		const {code, data} = await this.device.receiveData({
			label: 'GetDevicePropDesc',
			code: OpCode.GetDevicePropDesc,
			parameters: [deviceProp],
			expectedResCodes: [ResCode.OK, ResCode.DevicePropNotSupported],
		})

		if (code === ResCode.DevicePropNotSupported) {
			console.info(
				`DeviceProp: ${deviceProp.toString(16)} (${
					DevicePropCode[deviceProp]
				}) is not supported`
			)
			return null
		}

		const decoder = new PTPDecoder(data.slice(2))

		/*const devicePropCode =*/ decoder.getUint16()
		const dataType = decoder.getUint16()
		const getSet = decoder.getUint8()

		let getValue: () => number = decoder.getUint8

		if (dataType === 0x0002) {
			getValue = decoder.getUint8
		}

		const factoryDefaultValue = getValue()
		const currentValue = getValue()

		const desc: DevicePropDesc<number> = {
			getSet,
			factoryDefaultValue,
			currentValue,
		}

		// Read form
		const formFlag = getValue()

		if (formFlag === 0x01) {
			const range = {
				min: getValue(),
				max: getValue(),
				step: getValue(),
			}
			desc.range = range
		}

		return desc
	}

	protected getObjectInfo = async (objectID: number): Promise<ObjectInfo> => {
		const {data} = await this.device.receiveData({
			label: 'GetObjectInfo',
			code: OpCode.GetObjectInfo,
			parameters: [objectID],
		})

		const decoder = new PTPDecoder(data)

		return {
			objectID,
			storageID: decoder.getUint32(),
			objectFormat: decoder.getUint16(),
			protectionStatus: decoder.getUint16(),
			objectCompressedSize: decoder.getUint32(),
			thumbFormat: decoder.getUint16(),
			thumbCompressedSize: decoder.getUint32(),
			thumbPixWidth: decoder.getUint32(),
			thumbPixHeight: decoder.getUint32(),
			imagePixWidth: decoder.getUint32(),
			imagePixHeight: decoder.getUint32(),
			imageBitDepth: decoder.getUint32(),
			parentObject: decoder.getUint32(),
			associationType: decoder.getUint16(),
			associationDesc: decoder.getUint32(),
			sequenceNumber: decoder.getUint32(),
			filename: decoder.getString(),
			captureDate: decoder.getDate(),
			modificationDate: decoder.getDate(),
			keywords: decoder.getString(),
		}
	}

	public static getDeviceInfo = async function (
		device: PTPDevice
	): Promise<DeviceInfo> {
		const {data} = await device.receiveData({
			label: 'GetDeviceInfo',
			code: OpCode.GetDeviceInfo,
		})

		const decoder = new PTPDecoder(data)

		const info: DeviceInfo = {
			standardVersion: decoder.getUint16(),
			vendorExtensionID: decoder.getUint32(),
			vendorExtensionVersion: decoder.getUint16(),
			vendorExtensionDesc: decoder.getString(),
			functionalMode: decoder.getUint16(),
			operationsSupported: decoder.getUint16Array(),
			eventsSupported: decoder.getUint16Array(),
			devicePropertiesSupported: decoder.getUint16Array(),
			captureFormats: decoder.getUint16Array(),
			imageFormats: decoder.getUint16Array(),
			manufacturer: decoder.getString(),
			model: decoder.getString(),
			deviceVersion: decoder.getString(),
			serialNumber: decoder.getString(),
		}

		return info
	}

	protected static extractJpeg(buffer: ArrayBuffer): ArrayBuffer {
		const bytes = new Uint8Array(buffer)
		const len = bytes.length

		// look for the JPEG SOI marker (0xFFD8) in data
		let start: null | number = null

		for (let i = 0; i + 1 < len; i++) {
			if (bytes[i] === 0xff && bytes[i + 1] === 0xd8) {
				// SOI found
				start = i
				break
			}
		}
		if (start === null) /* no SOI -> no JPEG */ throw new Error('SOI not found')

		// look for the JPEG SOI marker (0xFFD8) in data
		let end: null | number = null

		for (let i = start + 2; i + 1 < len; i++) {
			if (bytes[i] === 0xff && bytes[i + 1] === 0xd9) {
				// EOI found
				end = i + 2
				break
			}
		}
		if (end === null)
			// no EOI -> no JPEG
			throw new Error('EOI not found')

		return buffer.slice(start, end)
	}
}
