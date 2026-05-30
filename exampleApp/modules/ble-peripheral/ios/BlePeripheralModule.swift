import ExpoModulesCore
import CoreBluetooth

private let kServiceUUID = CBUUID(string: "12345678-1234-1234-1234-123456789abc")
private let kCharUUID    = CBUUID(string: "abcdefab-1234-1234-1234-abcdefabcdef")

public class BlePeripheralModule: Module {
    private let ble = BlePeripheralDelegate()

    public func definition() -> ModuleDefinition {
        Name("BlePeripheral")

        Events("onPacketReceived")

        AsyncFunction("startPeripheral") { (promise: Promise) in
            self.ble.onPacketReceived = { [weak self] data in
                self?.sendEvent("onPacketReceived", ["data": data])
            }
            self.ble.start(promise: promise)
        }

        AsyncFunction("stopPeripheral") { (promise: Promise) in
            self.ble.stop()
            promise.resolve()
        }
    }
}

// ─── CBPeripheralManager delegate (separate class — needs NSObject) ───────────

private class BlePeripheralDelegate: NSObject, CBPeripheralManagerDelegate {
    private var manager:       CBPeripheralManager?
    private var pendingPromise: Promise?
    var onPacketReceived: ((String) -> Void)?

    func start(promise: Promise) {
        pendingPromise = promise
        if manager == nil {
            manager = CBPeripheralManager(delegate: self, queue: nil)
        } else if manager?.state == .poweredOn {
            setup()
        } else {
            promise.reject("BT_OFF", "Bluetooth is not powered on")
            pendingPromise = nil
        }
    }

    func stop() {
        manager?.stopAdvertising()
        manager?.removeAllServices()
    }

    private func setup() {
        manager?.removeAllServices()

        // Write characteristic — centrals write packets to us
        let char = CBMutableCharacteristic(
            type: kCharUUID,
            properties: [.write, .writeWithoutResponse],
            value: nil,
            permissions: .writeable
        )
        let service = CBMutableService(type: kServiceUUID, primary: true)
        service.characteristics = [char]
        manager?.add(service) // → peripheralManager(_:didAdd:error:)
    }

    func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        if peripheral.state == .poweredOn, pendingPromise != nil {
            setup()
        } else if peripheral.state != .poweredOn {
            pendingPromise?.reject("BT_OFF", "Bluetooth is not powered on")
            pendingPromise = nil
        }
    }

    func peripheralManager(_ peripheral: CBPeripheralManager,
                           didAdd service: CBService, error: Error?) {
        if let error = error {
            pendingPromise?.reject("ADD_SERVICE_FAILED", error.localizedDescription)
            pendingPromise = nil
            return
        }
        peripheral.startAdvertising([
            CBAdvertisementDataServiceUUIDsKey: [service.uuid],
            CBAdvertisementDataLocalNameKey: "MeshChat",
        ]) // → peripheralManagerDidStartAdvertising(_:error:)
    }

    func peripheralManagerDidStartAdvertising(_ peripheral: CBPeripheralManager,
                                              error: Error?) {
        if let error = error {
            pendingPromise?.reject("ADVERTISE_FAILED", error.localizedDescription)
        } else {
            pendingPromise?.resolve()
        }
        pendingPromise = nil
    }

    // Central wrote a packet to our characteristic — emit to JS
    func peripheralManager(_ peripheral: CBPeripheralManager,
                           didReceiveWrite requests: [CBATTRequest]) {
        for req in requests {
            peripheral.respond(to: req, withResult: .success)
            if let data = req.value, let str = String(data: data, encoding: .utf8) {
                onPacketReceived?(str)
            }
        }
    }
}
