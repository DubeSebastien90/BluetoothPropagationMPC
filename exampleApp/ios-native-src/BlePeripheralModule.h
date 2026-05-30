#import <React/RCTBridgeModule.h>
#import <CoreBluetooth/CoreBluetooth.h>

@interface BlePeripheralModule : NSObject <RCTBridgeModule, CBPeripheralManagerDelegate>

@property (nonatomic, strong) CBPeripheralManager *peripheralManager;
@property (nonatomic, strong) CBMutableCharacteristic *pingCharacteristic;
@property (nonatomic, copy)   RCTPromiseResolveBlock pendingResolve;
@property (nonatomic, copy)   RCTPromiseRejectBlock  pendingReject;
@property (nonatomic, assign) BOOL waitingToStart;

@end
