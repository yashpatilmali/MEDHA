/** One reading from the ESP32: FSR402 pressure plus SHTC3 temperature and humidity. */
export interface SensorData {
  pressure: number;
  temperature: number;
  humidity: number;
}
