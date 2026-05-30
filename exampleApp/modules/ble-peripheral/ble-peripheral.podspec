require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'ble-peripheral'
  s.version        = package['version']
  s.summary        = 'Local BLE Peripheral Expo Module'
  s.homepage       = 'https://github.com'
  s.license        = 'MIT'
  s.author         = 'dev'
  s.platforms      = { ios: '15.1' }
  s.source         = { git: '' }
  s.source_files   = 'ios/**/*.{swift}'
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
