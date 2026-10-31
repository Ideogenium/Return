export const getPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const requestPermissionsAsync = jest.fn().mockResolvedValue({ status: 'granted' });
export const getExpoPushTokenAsync = jest
  .fn()
  .mockResolvedValue({ data: 'ExponentPushToken[mock-token]' });
export const setNotificationHandler = jest.fn();
export const addNotificationReceivedListener = jest.fn().mockReturnValue({ remove: jest.fn() });
export const addNotificationResponseReceivedListener = jest
  .fn()
  .mockReturnValue({ remove: jest.fn() });
export const setNotificationChannelAsync = jest.fn().mockResolvedValue(undefined);
export const AndroidImportance = { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 };
export const getLastNotificationResponseAsync = jest.fn().mockResolvedValue(null);
