import {identity, range, times} from 'lodash'

import {
	ConfigForDevicePropTable,
	ConfigName,
	ConfigType,
	DriveModeTable,
	ExposureModeTable,
	WhiteBalanceTable,
} from '../configs'
import {DeviceInfo} from '../DeviceInfo'
import {
	DatatypeCode,
	DevicePropCode,
	EventCode,
	ObjectFormatCode,
	OpCode,
	PTPAccessCapabilityCode,
	PTPFilesystemTypeCode,
	PTPStorageTypeCode,
	ResCode,
} from '../PTPDatacode'
import {PTPDataView} from '../PTPDataView'
import {PTPDevice, PTPEvent} from '../PTPDevice'
import {ConfigDesc, OperationResult, TakePictureOption, Tethr} from '../Tethr'
import {TethrObject, TethrObjectInfo} from '../TethrObject'
import {toHexString} from '../util'

type DevicePropSchemeEntry<N extends ConfigName> = {
	devicePropCode: number
} & (
	| {
			dataType: DatatypeCode.Uint64
			decode: (data: bigint) => ConfigType[N] | null
			encode: (value: ConfigType[N]) => bigint | null
	  }
	| {
			dataType: DatatypeCode.String
			decode: (data: string) => ConfigType[N] | null
			encode: (value: ConfigType[N]) => string | null
	  }
	| {
			dataType: DatatypeCode
			decode: (data: number) => ConfigType[N] | null
			encode: (value: ConfigType[N]) => number | null
	  }
)

export type DevicePropScheme = {
	[N in ConfigName]?: DevicePropSchemeEntry<N>
}

export class TethrPTPUSB extends Tethr {
	protected _opened = false

	public constructor(protected device: PTPDevice) {
		super()
	}

	public get opened(): boolean {
		return this._opened
	}

	public async open(): Promise<void> {
		if (!this.device.opened) {
			await this.device.open()
		}

		await this.device.sendCommand({
			label: 'Open Session',
			opcode: OpCode.OpenSession,
			parameters: [0x1],
			expectedResCodes: [ResCode.OK, ResCode.SessionAlreadyOpen],
		})

		this.device.onEventCode(
			EventCode.DevicePropChanged,
			this.onDevicePropChanged
		)
		this.device.on('disconnect', () => this.emit('disconnect'))

		window.addEventListener('beforeunload', async () => {
			await this.close()
		})

		this._opened = true
	}

	public async close(): Promise<void> {
		this._opened = false

		await this.device.sendCommand({
			label: 'Close Session',
			opcode: OpCode.CloseSession,
		})
		await this.device.close()
	}

	public async set<K extends ConfigName>(
		name: K,
		value: ConfigType[K]
	): Promise<OperationResult<void>> {
		const scheme = this.devicePropScheme[name]

		if (!scheme) {
			return {
				status: 'unsupported',
			}
		}

		if (!(await this.isDevicePropSupported(scheme.devicePropCode))) {
			return {
				status: 'unsupported',
			}
		}

		const encode = scheme.encode as (value: ConfigType[K]) => number
		const devicePropData = encode(value)

		if (devicePropData === null) {
			return {
				status: 'invalid parameter',
			}
		}

		const dataView = new PTPDataView()
		switch (scheme.dataType) {
			case DatatypeCode.Uint8:
				dataView.writeUint8(devicePropData)
				break
			case DatatypeCode.Int8:
				dataView.writeInt8(devicePropData)
				break
			case DatatypeCode.Uint16:
				dataView.writeUint16(devicePropData)
				break
			case DatatypeCode.Int16:
				dataView.writeInt16(devicePropData)
				break
			case DatatypeCode.Uint32:
				dataView.writeUint32(devicePropData)
				break
			case DatatypeCode.Int32:
				dataView.writeInt32(devicePropData)
				break
			case DatatypeCode.Uint64:
				dataView.writeBigUint64(BigInt(devicePropData))
				break
			case DatatypeCode.String:
				dataView.writeBigUint64(BigInt(devicePropData))
				break
			default: {
				const label = DatatypeCode[scheme.dataType] ?? toHexString(16)
				throw new Error(
					`DevicePropDesc of datatype ${label} is not yet supported`
				)
			}
		}

		const {resCode} = await this.device.sendData({
			label: 'SetDevicePropValue',
			opcode: OpCode.SetDevicePropValue,
			parameters: [scheme.devicePropCode],
			data: dataView.toBuffer(),
			expectedResCodes: [ResCode.OK, ResCode.DeviceBusy],
		})

		return {
			status: resCode === ResCode.OK ? 'ok' : 'busy',
		}
	}

	public async getDesc<K extends ConfigName, T extends ConfigType[K]>(
		name: K
	): Promise<ConfigDesc<T>> {
		const scheme = this.devicePropScheme[name]
		if (scheme) {
			return await this.getDevicePropDesc(scheme)
		}

		switch (name) {
			case 'model': {
				const value = (await this.getDeviceInfo()).model
				return {
					writable: false,
					value: value as T,
					options: [],
				}
			}
			case 'canTakePicture': {
				const {operationsSupported} = await this.getDeviceInfo()
				const can = operationsSupported.includes(OpCode.InitiateCapture)
				return {
					writable: false,
					value: can as T,
					options: [],
				}
			}

			case 'canRunAutoFocus':
			case 'canRunManualFocus':
			case 'canStartLiveview':
				return {
					writable: false,
					value: false as T,
					options: [],
				}
		}

		return super.getDesc(name)
	}

	private async getDevicePropDesc<Name extends ConfigName>(
		scheme: DevicePropSchemeEntry<Name>
	) {
		// Check if the deviceProps is supported
		if (!(await this.isDevicePropSupported(scheme.devicePropCode))) {
			return {
				writable: false,
				value: null,
				options: [],
			}
		}

		const {data} = await this.device.receiveData({
			label: 'GetDevicePropDesc',
			opcode: OpCode.GetDevicePropDesc,
			parameters: [scheme.devicePropCode],
		})

		const decode = scheme.decode as (data: number) => any

		const dataView = new PTPDataView(data.slice(2))
		const dataType = dataView.readUint16()
		const writable = dataView.readUint8() === 0x01 // Get/Set

		let readValue: () => any

		switch (dataType) {
			case DatatypeCode.Uint8:
				readValue = dataView.readUint8
				break
			case DatatypeCode.Uint16:
				readValue = dataView.readUint16
				break
			case DatatypeCode.Int16:
				readValue = dataView.readInt16
				break
			case DatatypeCode.Uint32:
				readValue = dataView.readUint32
				break
			case DatatypeCode.Uint64:
				readValue = dataView.readUint64
				break
			case DatatypeCode.String:
				readValue = dataView.readUTF16StringNT
				break
			default: {
				const label = DatatypeCode[dataType] ?? toHexString(16)
				throw new Error(`PropDesc of datatype ${label} is not yet supported`)
			}
		}

		readValue() // Skip factoryDefault
		const value = decode(readValue())

		// Read options
		const formFlag = dataView.readUint8()

		let options: ConfigType[Name][]

		switch (formFlag) {
			case 0x00:
				// None
				options = []
				break
			case 0x01: {
				// Range
				const min = decode(readValue())
				const max = decode(readValue())
				const step = decode(readValue())
				if (
					typeof min !== 'number' ||
					typeof max !== 'number' ||
					typeof step !== 'number'
				) {
					throw new Error(`Cannot enumerate supported values of device config`)
				}
				options = range(min, max, step) as ConfigType[Name][]
				break
			}
			case 0x02: {
				// Enumeration
				const length = dataView.readUint16()
				options = times(length, readValue).map(decode)
				break
			}
			default:
				throw new Error(`Invalid form flag ${formFlag}`)
		}

		return {
			writable: writable && options.length > 1,
			value,
			options,
		}
	}

	private async isDevicePropSupported(code: number): Promise<boolean> {
		const {devicePropsSupported} = await this.getDeviceInfo()
		return devicePropsSupported.includes(code)
	}

	public async takePicture({download = true}: TakePictureOption = {}): Promise<
		OperationResult<TethrObject[]>
	> {
		const {operationsSupported} = await this.getDeviceInfo()
		if (!operationsSupported.includes(OpCode.InitiateCapture)) {
			return {status: 'unsupported'}
		}

		await this.device.sendCommand({
			label: 'InitiateCapture',
			opcode: OpCode.InitiateCapture,
			parameters: [0x0],
		})

		const objectAddedEvent = await this.device.waitEvent(EventCode.ObjectAdded)

		if (!download) return {status: 'ok', value: []}

		const objectID = objectAddedEvent.parameters[0]
		const objectInfo = await this.getObjectInfo(objectID)
		const objectBuffer = await this.getObject(objectID)

		const tethrObject: TethrObject = {
			...objectInfo,
			blob: new Blob([objectBuffer], {type: 'image/jpeg'}),
		}

		return {status: 'ok', value: [tethrObject]}
	}

	protected getDeviceInfo = async (): Promise<DeviceInfo> => {
		return await TethrPTPUSB.getDeviceInfo(this.device)
	}

	protected async getObjectInfo(id: number): Promise<TethrObjectInfo> {
		const {data} = await this.device.receiveData({
			label: 'GetObjectInfo',
			opcode: OpCode.GetObjectInfo,
			parameters: [id],
		})

		const dataView = new PTPDataView(data)

		return {
			id,
			storageID: dataView.readUint32(),
			format: this.getObjectFormatNameByCode(dataView.readUint16()),
			// protectionStatus: dataView.readUint16(),
			byteLength: dataView.skip(2).readUint32(),
			thumb: {
				format: this.getObjectFormatNameByCode(dataView.readUint16()),
				compressedSize: dataView.readUint32(),
				width: dataView.readUint32(),
				height: dataView.readUint32(),
			},
			image: {
				width: dataView.readUint32(),
				height: dataView.readUint32(),
				bitDepth: dataView.readUint32(),
			},
			// parent: dataView.readUint32(),
			// associationType: dataView.readUint16(),
			// associationDesc: dataView.readUint32(),
			sequenceNumber: dataView.skip(4 + 2 + 4).readUint32(),
			filename: dataView.readFixedUTF16String(),
			captureDate: dataView.readDate(),
			modificationDate: dataView.readDate(),
			// keywords: dataView.readFixedUTF16String(),
		}
	}

	protected async getObject(objectID: number): Promise<ArrayBuffer> {
		const {byteLength} = await this.getObjectInfo(objectID)

		const {data} = await this.device.receiveData({
			label: 'GetObject',
			opcode: OpCode.GetObject,
			parameters: [objectID],
			maxByteLength: byteLength + 1000,
		})

		return data
	}

	protected async getStorageInfo(): Promise<void> {
		const {data} = await this.device.receiveData({
			label: 'Get Storage IDs',
			opcode: OpCode.GetStorageIDs,
		})
		const dataView = new PTPDataView(data)

		const storageIDs = dataView.readUint32Array()
		console.log('Storage IDs =', storageIDs)

		for (const id of storageIDs) {
			const {data} = await this.device.receiveData({
				label: 'GetStorageInfo',
				parameters: [id],
				opcode: OpCode.GetStorageInfo,
			})

			const storageInfo = new PTPDataView(data)

			const info = {
				storageType: PTPStorageTypeCode[storageInfo.readUint16()],
				filesystemType: PTPFilesystemTypeCode[storageInfo.readUint16()],
				accessCapability: PTPAccessCapabilityCode[storageInfo.readUint16()],
				maxCapability: storageInfo.readUint64(),
				freeSpaceInBytes: storageInfo.readUint64(),
				freeSpaceInImages: storageInfo.readUint32(),
			}

			console.log(`Storage info for ${id}=`, info)
		}
	}

	protected onDevicePropChanged = async (event: PTPEvent) => {
		const devicePropCode = event.parameters[0]
		const name = this.getConfigNameByCode(devicePropCode)

		if (!name) return

		const desc = await this.getDesc(name)
		this.emit(`${name}Changed`, desc)
	}

	protected getConfigNameByCode(code: number) {
		return ConfigForDevicePropTable.get(code) ?? null
	}

	protected getObjectFormatNameByCode(code: number) {
		return ObjectFormatCode[code].toLowerCase()
	}

	protected devicePropScheme: DevicePropScheme = {
		exposureMode: {
			devicePropCode: DevicePropCode.ExposureProgramMode,
			dataType: DatatypeCode.Uint16,
			decode: data => {
				return ExposureModeTable.get(data) ?? `vendor ${toHexString(data, 4)}`
			},
			encode: value => {
				return (
					ExposureModeTable.getKey(value) ??
					parseInt(value.replace('vendor ', ''), 16)
				)
			},
		},
		exposureComp: {
			devicePropCode: DevicePropCode.ExposureBiasCompensation,
			dataType: DatatypeCode.Int16,
			decode: mills => {
				if (mills === 0) return '0'

				const millsAbs = Math.abs(mills)

				const sign = mills > 0 ? '+' : '-'
				const integer = Math.floor(millsAbs / 1000)
				const fracMills = millsAbs % 1000

				let fraction = ''

				switch (fracMills) {
					case 300:
						fraction = '1/3'
						break
					case 500:
						fraction = '1/2'
						break
					case 700:
						fraction = '2/3'
						break
				}

				if (integer === 0) return `${sign}${fraction}`
				if (fraction === '') return `${sign}${integer}`
				return `${sign}${integer} ${fraction}`
			},
			encode: str => {
				if (str === '0') return 0

				const match = str.match(/^([+-]?)([0-9]+)?\s?(1\/2|1\/3|2\/3)?$/)

				if (!match) return null

				const [, signStr, integerStr, fractionStr] = match

				const sign = signStr === '-' ? -1 : +1
				const integer = parseInt(integerStr)
				let fracMills = 0
				switch (fractionStr) {
					case '1/3':
						fracMills = 300
						break
					case '1/2':
						fracMills = 500
						break
					case '2/3':
						fracMills = 700
						break
				}

				return sign * (integer * 1000 + fracMills)
			},
		},
		whiteBalance: {
			devicePropCode: DevicePropCode.WhiteBalance,
			dataType: DatatypeCode.Uint16,
			decode: data => {
				return WhiteBalanceTable.get(data) ?? `vendor ${toHexString(data, 4)}`
			},
			encode: value => {
				return (
					WhiteBalanceTable.getKey(value) ??
					parseInt(value.replace(/^vendor /, ''), 16)
				)
			},
		},
		iso: {
			devicePropCode: DevicePropCode.ExposureIndex,
			dataType: DatatypeCode.Uint16,
			decode: data => {
				if (data === 0xffff) return 'auto'
				return data
			},
			encode: iso => {
				if (iso === 'auto') return 0xffff
				return iso
			},
		},
		captureDelay: {
			devicePropCode: DevicePropCode.CaptureDelay,
			dataType: DatatypeCode.Uint32,
			decode: identity,
			encode: identity,
		},
		driveMode: {
			devicePropCode: DevicePropCode.StillCaptureMode,
			dataType: DatatypeCode.Uint16,
			decode: data => {
				return DriveModeTable.get(data) ?? 'normal'
			},
			encode: value => {
				return DriveModeTable.getKey(value) ?? 0x0
			},
		},
		imageSize: {
			devicePropCode: DevicePropCode.ImageSize,
			dataType: DatatypeCode.String,
			decode: identity,
			encode: identity,
		},
		timelapseNumber: {
			devicePropCode: DevicePropCode.TimelapseNumber,
			dataType: DatatypeCode.Uint16,
			decode: identity,
			encode: identity,
		},
		timelapseInterval: {
			devicePropCode: DevicePropCode.TimelapseInterval,
			dataType: DatatypeCode.Uint32,
			decode: identity,
			encode: identity,
		},
		batteryLevel: {
			devicePropCode: DevicePropCode.BatteryLevel,
			dataType: DatatypeCode.Uint8,
			decode: identity,
			encode: identity,
		},
	}

	public static async getDeviceInfo(device: PTPDevice): Promise<DeviceInfo> {
		const {data} = await device.receiveData({
			label: 'GetDeviceInfo',
			opcode: OpCode.GetDeviceInfo,
		})

		const dataView = new PTPDataView(data)

		return {
			standardVersion: dataView.readUint16(),
			vendorExtensionID: dataView.readUint32(),
			vendorExtensionVersion: dataView.readUint16(),
			vendorExtensionDesc: dataView.readFixedUTF16String(),
			functionalMode: dataView.readUint16(),
			operationsSupported: dataView.readUint16Array(),
			eventsSupported: dataView.readUint16Array(),
			devicePropsSupported: dataView.readUint16Array(),
			captureFormats: dataView.readUint16Array(),
			imageFormats: dataView.readUint16Array(),
			manufacturer: dataView.readFixedUTF16String(),
			model: dataView.readFixedUTF16String(),
			deviceVersion: dataView.readFixedUTF16String(),
			serialNumber: dataView.readFixedUTF16String(),
		}
	}
}
