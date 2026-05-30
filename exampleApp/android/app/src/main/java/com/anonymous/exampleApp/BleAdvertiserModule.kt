package com.anonymous.exampleApp

import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.bluetooth.le.BluetoothLeAdvertiser
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class BleAdvertiserModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "BleAdvertiser"

    private var advertiser: BluetoothLeAdvertiser? = null
    private var activeCallback: AdvertiseCallback? = null

    @ReactMethod
    fun startAdvertising(payload: String, promise: Promise) {
        try {
            val btManager = reactApplicationContext
                .getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
            advertiser = btManager.adapter.bluetoothLeAdvertiser
            if (advertiser == null) {
                promise.reject("UNSUPPORTED", "BLE advertising not supported on this device")
                return
            }

            val settings = AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(false)
                .setTimeout(0)
                .build()

            // Company ID 0x1234 (arbitrary, app-specific)
            // Android's API stores [companyId_low, companyId_high, ...data] in the packet
            val data = AdvertiseData.Builder()
                .addManufacturerData(0x1234, payload.toByteArray(Charsets.UTF_8))
                .setIncludeDeviceName(false)
                .setIncludeTxPowerLevel(false)
                .build()

            val cb = object : AdvertiseCallback() {
                override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
                    promise.resolve(null)
                }
                override fun onStartFailure(errorCode: Int) {
                    promise.reject("ADVERTISE_FAILED", "Error code: $errorCode")
                }
            }
            activeCallback = cb
            advertiser!!.startAdvertising(settings, data, cb)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Missing BLUETOOTH_ADVERTISE permission")
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun stopAdvertising(promise: Promise) {
        try {
            activeCallback?.let { advertiser?.stopAdvertising(it) }
            activeCallback = null
            promise.resolve(null)
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }
}
