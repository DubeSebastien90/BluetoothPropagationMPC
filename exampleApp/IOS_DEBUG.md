# iOS BLE Module Debug — Cannot find native module 'BlePeripheral'

## What's happening

`requireNativeModule('BlePeripheral')` throws at startup because the Swift Expo Module
is not being registered in the app, even after `npx expo prebuild` + `pod install`.

## Architecture

```
App.js
  Platform.OS === 'ios'
    → requireNativeModule('BlePeripheral')   ← fails
  Platform.OS === 'android'
    → NativeModules.BlePeripheral            ← works fine
```

The Swift module lives at:
```
modules/ble-peripheral/
  package.json
  expo-module.config.json
  ble-peripheral.podspec
  ios/
    BlePeripheralModule.swift
```

It is declared as a local dependency in the root `package.json`:
```json
"ble-peripheral": "file:./modules/ble-peripheral"
```

## What to check on Mac

### 1. Verify the symlink exists after npm install
```bash
ls -la node_modules/ble-peripheral
# Should show: node_modules/ble-peripheral -> ../modules/ble-peripheral
```

### 2. Verify autolinking finds the module
```bash
npx expo-modules-autolinking search
# Should list 'ble-peripheral' in the output
```

Or:
```bash
npx expo-modules-autolinking resolve --platform ios
# Should include BlePeripheralModule
```

### 3. Check ExpoModulesProvider.swift was generated with the module
```bash
cat ios/ExpoModulesProvider.swift | grep BlePeripheral
# Should show: BlePeripheralModule()
```

If this is EMPTY → autolinking did not pick up the module.

### 4. Check the Podfile includes the pod
```bash
cat ios/Podfile | grep ble-peripheral
```

If MISSING → add manually inside the `target 'exampleApp'` block:
```ruby
pod 'ble-peripheral', path: '../modules/ble-peripheral'
```

Then re-run:
```bash
cd ios && pod install && cd ..
```

### 5. Check the pod was installed
```bash
cat ios/Podfile.lock | grep ble-peripheral
# Should show: ble-peripheral (1.0.0)
```

If MISSING → CocoaPods did not find/install the pod.

### 6. Nuclear option — add Swift file directly to Xcode target

If autolinking keeps failing, bypass it entirely:

```bash
cp modules/ble-peripheral/ios/BlePeripheralModule.swift ios/exampleApp/
```

Then open `ios/exampleApp.xcworkspace` in Xcode:
- Right-click `exampleApp` folder in file tree
- Add Files to "exampleApp"
- Select `BlePeripheralModule.swift`
- Make sure "Add to target: exampleApp" is checked
- Click Add

Then register the module manually. Open `ios/ExpoModulesProvider.swift` and add:
```swift
BlePeripheralModule(),
```
to the array of modules.

Then rebuild:
```bash
npx expo run:ios --configuration Release --device
```

## BlePeripheralModule.swift content (for reference)

```swift
import ExpoModulesCore
import CoreBluetooth

private let kServiceUUID = CBUUID(string: "12345678-1234-1234-1234-123456789abc")
private let kCharUUID    = CBUUID(string: "abcdefab-1234-1234-1234-abcdefabcdef")

public class BlePeripheralModule: Module {
    private let ble = BlePeripheralDelegate()

    public func definition() -> ModuleDefinition {
        Name("BlePeripheral")

        AsyncFunction("startPeripheral") { (message: String, promise: Promise) in
            self.ble.start(message: message, promise: promise)
        }

        AsyncFunction("stopPeripheral") { (promise: Promise) in
            self.ble.stop()
            promise.resolve()
        }
    }
}

private class BlePeripheralDelegate: NSObject, CBPeripheralManagerDelegate {
    private var manager: CBPeripheralManager?
    private var pendingPromise: Promise?
    private var pendingMessage = ""

    func start(message: String, promise: Promise) {
        pendingMessage = message
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
        pendingMessage = ""
    }

    private func setup() {
        manager?.removeAllServices()
        let char = CBMutableCharacteristic(
            type: kCharUUID,
            properties: .read,
            value: pendingMessage.data(using: .utf8),
            permissions: .readable
        )
        let service = CBMutableService(type: kServiceUUID, primary: true)
        service.characteristics = [char]
        manager?.add(service)
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
        ])
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
```

## Most likely fix

Step 6 (nuclear option) is the most reliable if autolinking keeps failing.
It bypasses the entire autolinking system and directly includes the Swift file
in the Xcode project — guaranteed to work.
