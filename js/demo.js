// Logement fictif pour découvrir l'app sans compte (mode démo) : un hub Navilink, quatre pièces.
import { Caps, Schedules } from './model.js';

const caps = pairs => pairs.map(([id, v]) => ({ capabilityId: id, value: v, modificationDate: Math.floor(Date.now() / 1000) }));

function at(daysFromNow, hour) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

const S = (minute, temp, mode = 0) => ({ minute, temp, mode });
const WEEKDAY = [S(0, 18), S(390, 21), S(510, 0, 1), S(1050, 21), S(1350, 18)];
const WEEKEND = [S(0, 18), S(510, 21), S(1380, 18)];
const NIGHT = [S(0, 18), S(420, 19), S(540, 0, 1), S(1230, 20), S(1350, 18)];
const week = (wd, we) => [0, 1, 2, 3, 4, 5, 6].map(i => [Caps.PROG_HEAT_MONDAY + i, Schedules.format(i < 5 ? wd : we)]);

const AC_SERVICES = String(1 | 6 | 8 | 16 | 128 | 256);

export function demoSetup() {
  return {
    id: 1, name: 'Démo',
    gateways: [{ id: 9001, serialNumber: '1234-5678-9ABC-7C21', isAlive: true, type: 105 }],
    zones: [],
    devices: [
      { deviceId: 500, name: 'NAVI_HUB', productId: 63, gatewayId: 9001, capabilities: caps([
        [Caps.ABSENCE_HOME_STATE, '2'], [Caps.ABSENCE_HOME_DATE, `[${at(25, 9)},${at(33, 18)}]`],
        [Caps.ABSENCE_HEAT_TARGET, '16.0'], [Caps.ABSENCE_COOL_TARGET, '28.0'],
        [Caps.WIFI_RSSI, '-58'], [Caps.WIFI_CONNECTED, '0'], [Caps.ERROR_HOME, '[]'], [344, '4'],
      ]) },
      { deviceId: 501, name: 'ROOM_0', productId: 97, masterDeviceId: 500, gatewayId: 9001, capabilities: caps([
        [Caps.ROOM_NAME, 'Salon'], [Caps.AMBIENT, '20.5'], [Caps.SERVICE_REQUESTED, '4'], [Caps.SERVICE_IN_PROGRESS, '4'],
        [Caps.SERVICES_AVAILABLE, AC_SERVICES], [Caps.HEATING_STATUS, '1'],
        [Caps.HEATING_TARGET, '21.0'], [Caps.COOLING_TARGET, '24.0'], [Caps.MODE, '0'], [Caps.MODES_AVAILABLE, '3'],
        [Caps.DEROG_ACTIVE, '0'], [Caps.DEROG_DURATION, '120'],
        [Caps.FAN_SPEED, '5'], [Caps.FAN_SPEED_SET, '2'], [Caps.FAN_QUIET, '0'],
        [Caps.SWING, '1'], [Caps.FLAP_POSITION, '2'], [Caps.POWERFUL, '0'], [Caps.ENERGY_SAVING, '0'],
        [Caps.WINDOW_DETECTION, '1'], [Caps.WINDOW_OPEN, '1'], [Caps.ERROR_ROOM, '[]'],
        [Caps.MAX_MILESTONES_PER_DAY, '6'], [Caps.MILESTONE_STEP, '15'],
        ...week(WEEKDAY, WEEKEND),
      ]) },
      { deviceId: 502, name: 'ROOM_1', productId: 98, masterDeviceId: 500, gatewayId: 9001, capabilities: caps([
        [Caps.ROOM_NAME, 'Bureau'], [Caps.AMBIENT, '23.8'], [Caps.SERVICE_REQUESTED, '3'], [Caps.SERVICE_IN_PROGRESS, '3'],
        [Caps.SERVICES_AVAILABLE, AC_SERVICES], [Caps.HEATING_STATUS, '2'],
        [Caps.HEATING_TARGET, '20.0'], [Caps.COOLING_TARGET, '23.0'], [Caps.MODE, '0'], [Caps.MODES_AVAILABLE, '3'],
        [Caps.DEROG_ACTIVE, '0'], [Caps.DEROG_DURATION, '120'],
        [Caps.FAN_SPEED, '2'], [Caps.FAN_SPEED_SET, '2'], [Caps.FAN_QUIET, '0'],
        [Caps.SWING, '0'], [Caps.FLAP_POSITION, '1'], [Caps.POWERFUL, '0'], [Caps.ENERGY_SAVING, '0'],
        [Caps.WINDOW_DETECTION, '1'], [Caps.WINDOW_OPEN, '0'],
      ]) },
      { deviceId: 503, name: 'ROOM_2', productId: 99, masterDeviceId: 500, gatewayId: 9001, capabilities: caps([
        [Caps.ROOM_NAME, 'Chambre'], [Caps.AMBIENT, '19.0'], [Caps.SERVICE_REQUESTED, '1'], [Caps.SERVICE_IN_PROGRESS, '4'],
        [Caps.SERVICES_AVAILABLE, AC_SERVICES], [Caps.HEATING_STATUS, '1'],
        [Caps.HEATING_TARGET, '20.0'], [Caps.COOLING_TARGET, '25.0'], [Caps.MODE, '1'], [Caps.MODES_AVAILABLE, '3'],
        [Caps.DEROG_ACTIVE, '0'], [Caps.DEROG_DURATION, '120'],
        [Caps.FAN_SPEED, '5'], [Caps.FAN_SPEED_SET, '2'], [Caps.FAN_QUIET, '1'],
        [Caps.SWING, '0'], [Caps.FLAP_POSITION, '3'], [Caps.POWERFUL, '0'], [Caps.ENERGY_SAVING, '1'],
        [Caps.WINDOW_DETECTION, '1'], [Caps.WINDOW_OPEN, '0'],
        [Caps.MAX_MILESTONES_PER_DAY, '6'], [Caps.MILESTONE_STEP, '15'],
        ...week(NIGHT, NIGHT),
      ]) },
      { deviceId: 504, name: 'ROOM_3', productId: 100, masterDeviceId: 500, gatewayId: 9001, capabilities: caps([
        [Caps.ROOM_NAME, "Chambre d'amis"], [Caps.AMBIENT, '19.5'], [Caps.SERVICE_REQUESTED, '0'], [Caps.SERVICE_IN_PROGRESS, '0'],
        [Caps.SERVICES_AVAILABLE, AC_SERVICES], [Caps.HEATING_STATUS, '0'],
        [Caps.HEATING_TARGET, '19.0'], [Caps.COOLING_TARGET, '26.0'], [Caps.MODE, '0'], [Caps.MODES_AVAILABLE, '3'],
        [Caps.FAN_SPEED, '1'], [Caps.FAN_SPEED_SET, '2'], [Caps.FAN_QUIET, '0'],
        [Caps.SWING, '0'], [Caps.FLAP_POSITION, '2'], [Caps.POWERFUL, '0'],
      ]) },
      { deviceId: 505, name: 'Salon UI', productId: 65, masterDeviceId: 500, capabilities: [] },
    ],
  };
}
