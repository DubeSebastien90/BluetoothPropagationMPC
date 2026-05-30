#import "BlePeripheralModule.h"

static NSString *const kServiceUUID = @"12345678-1234-1234-1234-123456789abc";
static NSString *const kCharUUID    = @"abcdefab-1234-1234-1234-abcdefabcdef";

@implementation BlePeripheralModule

RCT_EXPORT_MODULE(BlePeripheral);

+ (BOOL)requiresMainQueueSetup { return NO; }

// ------------------------------------------------------------------
// JS-callable methods
// ------------------------------------------------------------------

RCT_EXPORT_METHOD(startPeripheral:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  self.pendingResolve = resolve;
  self.pendingReject  = reject;
  self.waitingToStart = YES;

  if (!self.peripheralManager) {
    self.peripheralManager = [[CBPeripheralManager alloc] initWithDelegate:self queue:nil];
    // Will call peripheralManagerDidUpdateState: when ready
  } else if (self.peripheralManager.state == CBManagerStatePoweredOn) {
    [self setupAndAdvertise];
  } else {
    reject(@"BT_OFF", @"Bluetooth is not powered on", nil);
    self.pendingResolve = nil;
    self.pendingReject  = nil;
  }
}

RCT_EXPORT_METHOD(stopPeripheral:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
  self.waitingToStart = NO;
  [self.peripheralManager stopAdvertising];
  [self.peripheralManager removeAllServices];
  resolve(nil);
}

// ------------------------------------------------------------------
// CBPeripheralManagerDelegate
// ------------------------------------------------------------------

- (void)peripheralManagerDidUpdateState:(CBPeripheralManager *)peripheral {
  if (peripheral.state == CBManagerStatePoweredOn && self.waitingToStart) {
    [self setupAndAdvertise];
  } else if (peripheral.state != CBManagerStatePoweredOn) {
    if (self.pendingReject) {
      self.pendingReject(@"BT_OFF", @"Bluetooth is not powered on", nil);
      self.pendingResolve = nil;
      self.pendingReject  = nil;
    }
  }
}

- (void)setupAndAdvertise {
  [self.peripheralManager removeAllServices];

  self.pingCharacteristic = [[CBMutableCharacteristic alloc]
    initWithType:[CBUUID UUIDWithString:kCharUUID]
    properties:CBCharacteristicPropertyWrite | CBCharacteristicPropertyWriteWithoutResponse
    value:nil
    permissions:CBAttributePermissionsWriteable];

  CBMutableService *service = [[CBMutableService alloc]
    initWithType:[CBUUID UUIDWithString:kServiceUUID]
    primary:YES];
  service.characteristics = @[self.pingCharacteristic];

  [self.peripheralManager addService:service]; // → didAddService:error:
}

- (void)peripheralManager:(CBPeripheralManager *)peripheral
           didAddService:(CBService *)service
                   error:(NSError *)error {
  if (error) {
    if (self.pendingReject) {
      self.pendingReject(@"ADD_SERVICE_FAILED", error.localizedDescription, error);
      self.pendingResolve = nil;
      self.pendingReject  = nil;
    }
    return;
  }
  [peripheral startAdvertising:@{
    CBAdvertisementDataServiceUUIDsKey: @[service.UUID],
    CBAdvertisementDataLocalNameKey: @"PingApp"
  }]; // → peripheralManagerDidStartAdvertising:error:
}

- (void)peripheralManagerDidStartAdvertising:(CBPeripheralManager *)peripheral
                                       error:(NSError *)error {
  if (error) {
    if (self.pendingReject) {
      self.pendingReject(@"ADVERTISE_FAILED", error.localizedDescription, error);
    }
  } else {
    if (self.pendingResolve) {
      self.pendingResolve(nil);
    }
  }
  self.pendingResolve = nil;
  self.pendingReject  = nil;
}

// Respond to write-with-response requests; write-without-response needs no reply.
- (void)peripheralManager:(CBPeripheralManager *)peripheral
  didReceiveWriteRequests:(NSArray<CBATTRequest *> *)requests {
  for (CBATTRequest *req in requests) {
    [peripheral respondToRequest:req withResult:CBATTErrorSuccess];
  }
}

@end
