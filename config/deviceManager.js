const path = require('path');
const axios = require('axios');
const { getSettingsWithCache, getSetting } = require('./settingsManager');
const billingManager = require('./billing');
const { findDeviceByTag } = require('./addWAN');
const { findDeviceByPPPoE } = require('./genieacs');

// parameterPaths and getParameterWithPaths from WhatsApp bot & customerPortal
const parameterPaths = {
  rxPower: [
    'VirtualParameters.RXPower',
    'VirtualParameters.redaman',
    'InternetGatewayDevice.WANDevice.1.WANPONInterfaceConfig.RXPower',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.X_ALU-COM_RxPower',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.RxPower',
    'Device.Optical.Interface.1.RxPower'
  ],
  pppoeIP: [
    'VirtualParameters.pppoeIP',
    'VirtualParameters.pppIP',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',
    'Device.PPP.Interface.1.IPCPExtensions.RemoteIPAddress'
  ],
  pppUsername: [
    'VirtualParameters.pppoeUsername',
    'VirtualParameters.pppUsername',
    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
    'Device.PPP.Interface.1.Username'
  ],
  uptime: [
    'VirtualParameters.getdeviceuptime',
    'InternetGatewayDevice.DeviceInfo.UpTime',
    'Device.DeviceInfo.UpTime'
  ],
  softwareVersion: [
    'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
    'Device.DeviceInfo.SoftwareVersion',
    'VirtualParameters.softwareVersion'
  ],
  userConnected: [
    'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.TotalAssociations',
    'VirtualParameters.activedevices',
    'Device.WiFi.AccessPoint.1.AssociatedDeviceNumberOfEntries'
  ]
};

function normalizePhone(input) {
  if (!input) return '';
  let s = String(input).replace(/[^0-9+]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('0')) return '62' + s.slice(1);
  if (s.startsWith('62')) return s;
  if (/^8[0-9]{7,13}$/.test(s)) return '62' + s;
  return s;
}

function generatePhoneVariants(input) {
  const raw = String(input || '');
  const norm = normalizePhone(raw);
  const local = norm.startsWith('62') ? '0' + norm.slice(2) : raw;
  const plus = norm.startsWith('62') ? '+62' + norm.slice(2) : raw;
  const shortLocal = local.startsWith('0') ? local.slice(1) : local;
  return Array.from(new Set([raw, norm, local, plus, shortLocal].filter(Boolean)));
}

function getParameterWithPaths(device, paths) {
  for (const path of paths) {
    const parts = path.split('.');
    let value = device;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
        if (value && typeof value === 'object' && value._value !== undefined) {
          value = value._value;
        }
      } else {
        value = undefined;
        break;
      }
    }
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return '-';
}

/**
 * Ambil info perangkat dan user terhubung
 */
async function getCustomerDeviceData(phone) {
  try {
    let customer = null;
    const phoneVariants = generatePhoneVariants(phone);
    
    for (const variant of phoneVariants) {
      try {
        customer = await billingManager.getCustomerByPhone(variant);
        if (customer) {
            customer.role = 'customer';
            break;
        }
      } catch (error) {}
    }
    
    // Also try checking member if customer not found
    if (!customer) {
        for (const variant of phoneVariants) {
            try {
              customer = await billingManager.getMemberByPhone(variant);
              if (customer) {
                  customer.role = 'member';
                  break;
              }
            } catch (error) {}
        }
    }
    
    let device = null;
    let billingData = null;
    
    if (customer) {
      if (customer.pppoe_username || customer.username) {
        try {
          const pppoeToSearch = customer.pppoe_username || customer.username;
          device = await findDeviceByPPPoE(pppoeToSearch, customer);
        } catch (error) {
          console.error('Error finding device by PPPoE username:', error.message);
        }
      }
      
      if (!device) {
        const tagVariants = generatePhoneVariants(phone);
        for (const v of tagVariants) {
          try {
            device = await findDeviceByTag(v);
            if (device) break;
          } catch (error) {}
        }
      }
      
      try {
        const invoices = await billingManager.getInvoicesByCustomer(customer.id);
        billingData = {
          customer: customer,
          invoices: invoices || []
        };
      } catch (error) {
        billingData = { customer: customer, invoices: [] };
      }
      
    } else {
      const tagVariants = generatePhoneVariants(phone);
      for (const v of tagVariants) {
        try {
          device = await findDeviceByTag(v);
          if (device) break;
        } catch (error) {}
      }
    }
    
    if (!device) {
      return {
        phone: phone,
        ssid: customer ? `WiFi-${customer.username || customer.hotspot_username}` : 'WiFi-Default',
        status: 'Unknown',
        lastInform: '-',
        softwareVersion: '-',
        rxPower: '-',
        pppoeIP: '-',
        pppoeUsername: customer ? (customer.pppoe_username || customer.username || customer.hotspot_username) : '-',
        totalAssociations: '0',
        connectedUsers: [],
        billingData: billingData,
        deviceFound: false
      };
    }
    
    const ssid = device?.InternetGatewayDevice?.LANDevice?.['1']?.WLANConfiguration?.['1']?.SSID?._value || 
                 device?.VirtualParameters?.SSID || 
                 (customer ? `WiFi-${customer.username || customer.hotspot_username}` : 'WiFi-Default');
    
    const lastInform = device?._lastInform
      ? new Date(device._lastInform).toLocaleString('id-ID')
      : '-';
    
    let status = 'Unknown';
    if (device?._lastInform) {
      const lastInformTime = new Date(device._lastInform).getTime();
      const currentTime = Date.now();
      const diffMinutes = (currentTime - lastInformTime) / (1000 * 60);
      status = diffMinutes < 5 ? 'Online' : 'Offline';
    }
    
    // Connected users (mock for now as per original code)
    let connectedUsers = [];
    const totalAssociations = getParameterWithPaths(device, parameterPaths.userConnected);
    
    const softwareVersion = getParameterWithPaths(device, parameterPaths.softwareVersion);
    const rxPower = getParameterWithPaths(device, parameterPaths.rxPower);
    const pppoeIP = getParameterWithPaths(device, parameterPaths.pppoeIP);
    const uptime = getParameterWithPaths(device, parameterPaths.uptime);
    
    return {
      phone: phone,
      ssid: ssid,
      status: status,
      lastInform: lastInform,
      softwareVersion: softwareVersion,
      rxPower: rxPower,
      pppoeIP: pppoeIP,
      pppoeUsername: customer ? (customer.pppoe_username || customer.username || customer.hotspot_username) : 
                     getParameterWithPaths(device, parameterPaths.pppUsername),
      totalAssociations: totalAssociations,
      connectedUsers: connectedUsers,
      billingData: billingData,
      deviceFound: true,
      deviceId: device._id,
      serialNumber: device.DeviceID?.SerialNumber || device._id,
      model: device.DeviceID?.ProductClass || '-',
      uptime: uptime
    };
    
  } catch (error) {
    console.error('Error in getCustomerDeviceData:', error);
    return {
      phone: phone,
      status: 'Error',
      deviceFound: false,
      message: 'Terjadi kesalahan saat mengambil data device.'
    };
  }
}

module.exports = {
  getCustomerDeviceData,
  normalizePhone,
  generatePhoneVariants
};
