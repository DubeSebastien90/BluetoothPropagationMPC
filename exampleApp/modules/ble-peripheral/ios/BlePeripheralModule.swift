import ExpoModulesCore
import CoreBluetooth

private let kServiceUUID = CBUUID(string: "12345678-1234-1234-1234-123456789abc")
private let kCharUUID    = CBUUID(string: "abcdefab-1234-1234-1234-abcdefabcdef")

// ─── Expo Module ──────────────────────────────────────────────────────────────
// AsyncFunction handles (String, Promise) natively — no ObjC interop bug.

public class BlePeripheralModule: Module {
    private let ble = BlePeripheralDelegate()

    public func definition() -> ModuleDefinition {
        Name("BlePeripheral")

        // Atomic: message and start in one call
        AsyncFunction("startPeripheral") { (message: String, promise: Promise) in
            self.ble.start(message: message, promise: promise)
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
    private var pendingMessage = ""

    func start(message: String, promise: Promise) {
        pendingMessage = message
        pendingPromise = promise

        if manager == nil {
            manager = CBPeripheralManager(delegate: self, queue: nil)
            // peripheralManagerDidUpdateState fires when ready
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
        pendingMessage = ""
    }

    // ── State machine ─────────────────────────────────────────────────────────

    private func setup() {
        manager?.removeAllServices()

        // Static value — CoreBluetooth answers reads automatically, no delegate needed
        let char = CBMutableCharacteristic(
            type: kCharUUID,
            properties: .read,
            value: pendingMessage.data(using: .utf8),
            permissions: .readable
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
            CBAdvertisementDataLocalNameKey: "MsgApp",
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
}
