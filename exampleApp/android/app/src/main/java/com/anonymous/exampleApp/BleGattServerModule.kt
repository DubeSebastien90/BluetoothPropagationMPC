package com.anonymous.exampleApp

import android.bluetooth.*
import android.bluetooth.le.*
import android.content.Context
import android.os.ParcelUuid
import com.facebook.react.bridge.*
import java.util.UUID

class BleGattServerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "BlePeripheral"

    companion object {
        val SERVICE_UUID = UUID.fromString("12345678-1234-1234-1234-123456789abc")
        val CHAR_UUID    = UUID.fromString("abcdefab-1234-1234-1234-abcdefabcdef")
    }

    private var gattServer:        BluetoothGattServer? = null
    private var advertiser:        BluetoothLeAdvertiser? = null
    private var advertiseCallback: AdvertiseCallback? = null
    private var startPromise:      Promise? = null
    private var messageBytes:      ByteArray = ByteArray(0)

    private val gattCallback = object : BluetoothGattServerCallback() {
        override fun onCharacteristicReadRequest(
            device: BluetoothDevice, requestId: Int,
            offset: Int, characteristic: BluetoothGattCharacteristic
        ) {
            val data = if (offset < messageBytes.size) messageBytes.copyOfRange(offset, messageBytes.size)
                       else ByteArray(0)
            gattServer?.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, data)
        }

        override fun onServiceAdded(status: Int, service: BluetoothGattService) {
            if (status == BluetoothGatt.GATT_SUCCESS) {
                beginAdvertising()
            } else {
                startPromise?.reject("GATT_FAILED", "Failed to add service, status: $status")
                startPromise = null
            }
        }
    }

    @ReactMethod
    fun setMessage(message: String) {
        messageBytes = message.toByteArray(Charsets.UTF_8)
    }

    @ReactMethod
    fun startPeripheral(promise: Promise) {
        try {
            val btManager = reactApplicationContext
                .getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

            advertiser = btManager.adapter.bluetoothLeAdvertiser
            if (advertiser == null) {
                promise.reject("UNSUPPORTED", "BLE advertising not supported on this device")
                return
            }

            gattServer = btManager.openGattServer(reactApplicationContext, gattCallback)
            if (gattServer == null) {
                promise.reject("ERROR", "Could not open GATT server")
                return
            }

            startPromise = promise

            val characteristic = BluetoothGattCharacteristic(
                CHAR_UUID,
                BluetoothGattCharacteristic.PROPERTY_READ,
                BluetoothGattCharacteristic.PERMISSION_READ
            )
            val service = BluetoothGattService(SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
            service.addCharacteristic(characteristic)
            gattServer!!.addService(service) // async → onServiceAdded → beginAdvertising → onStartSuccess
        } catch (e: SecurityException) {
            startPromise = null
            promise.reject("PERMISSION_DENIED", e.message)
        } catch (e: Exception) {
            startPromise = null
            promise.reject("ERROR", e.message)
        }
    }

    private fun beginAdvertising() {
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .setTimeout(0)
            .build()

        val data = AdvertiseData.Builder()
            .addServiceUuid(ParcelUuid(SERVICE_UUID))
            .setIncludeDeviceName(false)
            .build()

        advertiseCallback = object : AdvertiseCallback() {
            override fun onStartSuccess(settingsInEffect: AdvertiseSettings) {
                startPromise?.resolve(null)
                startPromise = null
            }
            override fun onStartFailure(errorCode: Int) {
                startPromise?.reject("ADVERTISE_FAILED", "Error code: $errorCode")
                startPromise = null
            }
        }

        try {
            advertiser?.startAdvertising(settings, data, advertiseCallback)
        } catch (e: SecurityException) {
            startPromise?.reject("PERMISSION_DENIED", e.message)
            startPromise = null
        }
    }

    @ReactMethod
    fun stopPeripheral(promise: Promise) {
        try {
            advertiseCallback?.let { advertiser?.stopAdvertising(it) }
            advertiseCallback = null
            gattServer?.close()
            gattServer = null
        } catch (_: Exception) {}
        promise.resolve(null)
    }
}
