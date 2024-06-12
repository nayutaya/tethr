import EventEmitter from 'eventemitter3'

import {Tethr} from './Tethr'
import {initTethrUSBPTP, TethrPTPUSB} from './TethrPTPUSB'
import {TethrWebcam} from './TethrWebcam'

type TethrManagerEvents = {
	pairedCameraChange: (cameras: Tethr[]) => void
}

export class TethrManager extends EventEmitter<TethrManagerEvents> {
	#ptpusbCameras: Map<USBDevice, TethrPTPUSB> = new Map()
	#webcamCameras: Map<string, TethrWebcam> = new Map()

	constructor() {
		super()

		this.#init()
	}

	async #init() {
		await Promise.allSettled([
			this.#initPairedUSBPTPCameras(),
			this.#refreshPairedWebcam(),
		])

		this.#emitPairedCameras()

		// Detect USB PTP camera changes
		navigator.usb.addEventListener('connect', async event => {
			const camera = await initTethrUSBPTP(event.device)
			if (camera) {
				this.#ptpusbCameras.set(event.device, camera)
				this.#emitPairedCameras()
			}
		})

		navigator.usb.addEventListener('disconnect', event => {
			const camera = this.#ptpusbCameras.get(event.device)
			if (camera) {
				this.#ptpusbCameras.delete(event.device)
				this.#emitPairedCameras()
			}
		})

		// Detect webcam changes
		navigator.mediaDevices.addEventListener('devicechange', async e => {
			await this.#refreshPairedWebcam()
			this.#emitPairedCameras()
		})
	}

	/**
	 * Initialize paired USB PTP cameras and add them to the manager. This should be called once during initialization.
	 */
	async #initPairedUSBPTPCameras() {
		const usbDevices = await navigator.usb.getDevices()
		const usbPromises = await Promise.allSettled(
			usbDevices.map(initTethrUSBPTP)
		)
		const cameras = usbPromises
			.filter(promise => promise.status === 'fulfilled')
			.map(promise => (promise as PromiseFulfilledResult<TethrPTPUSB>).value)

		for (const camera of cameras) {
			this.#ptpusbCameras.set(camera.device.usb, camera)
		}
	}

	async #refreshPairedWebcam(): Promise<TethrWebcam | null> {
		const devices = await this.enumerateWebcamDeviceInfo()

		let camera: TethrWebcam | null = null

		const prevCameras = this.#webcamCameras

		this.#webcamCameras = new Map()

		for (const device of devices) {
			if (device.kind !== 'videoinput' || device.deviceId === '') {
				continue
			}

			const prevCamera = prevCameras.get(device.deviceId)

			if (prevCamera) {
				this.#webcamCameras.set(device.deviceId, prevCamera)
			} else {
				camera = new TethrWebcam(device)
				this.#webcamCameras.set(device.deviceId, camera)
			}
		}

		return camera ?? [...this.#webcamCameras.values()][0] ?? null
	}

	#emitPairedCameras() {
		const cameras = [
			...this.#ptpusbCameras.values(),
			...this.#webcamCameras.values(),
		]

		this.emit('pairedCameraChange', cameras)
	}

	/**
	 * Request an exclusive connection to a camera. This will prompt the user to select a camera to connect to. This should be called in response to a user action, such as a button click.
	 * @param type The type of camera to request
	 * @returns A list of cameras that were successfully connected to
	 */
	async requestCamera(type: 'usbptp' | 'webcam'): Promise<Tethr | null> {
		let camera: Tethr | null = null

		switch (type) {
			case 'usbptp': {
				const ptpusbCamera = await this.requestUSBPTPCamera()
				if (ptpusbCamera) {
					this.#ptpusbCameras.set(ptpusbCamera.device.usb, ptpusbCamera)
				}
				camera = ptpusbCamera
				break
			}
			case 'webcam': {
				camera = await this.requestWebcam()
			}
		}

		if (camera) {
			this.#emitPairedCameras()
		}

		return camera
	}

	private async requestUSBPTPCamera(): Promise<TethrPTPUSB | null> {
		let usbDevice: USBDevice
		try {
			usbDevice = await navigator.usb.requestDevice({filters: []})
		} catch {
			return null
		}

		return await initTethrUSBPTP(usbDevice)
	}

	private async requestWebcam() {
		const media = await navigator.mediaDevices.getUserMedia({video: true})
		media.getTracks().forEach(track => track.stop())

		return this.#refreshPairedWebcam()
	}

	private async enumerateWebcamDeviceInfo() {
		const devices = await navigator.mediaDevices.enumerateDevices()
		const webcams = devices.filter(device => device.kind === 'videoinput')
		return webcams
	}
}
