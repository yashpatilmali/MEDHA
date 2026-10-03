#include <Arduino.h>
#include <DHT.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

// ==============================
// Settings: change these
// ==============================

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend address, no trailing slash. Either the Render URL, or for local
// testing the computer's IP on the same Wi-Fi, e.g. "http://192.168.1.20:4000".
const char* SERVER_URL = "https://medha-backend.onrender.com";

// The patient's device ID, shown on the app's Profile tab after registering.
const char* DEVICE_ID = "SP-ESP32-001";

// Must equal DEVICE_API_KEY in backend/.env (or on Render).
const char* DEVICE_API_KEY = "PASTE_YOUR_DEVICE_API_KEY";

// How often a reading is sent. The DHT11 can't be read faster than once a second.
const unsigned long SEND_INTERVAL_MS = 2000;

// Optional buzzer or LED that turns on while the status is CRITICAL. -1 = none.
const int ALERT_PIN = -1;

// ==============================
// Pin Definitions
// ==============================
#define FSR_PIN 34
#define DHT_PIN 4

#define DHT_TYPE DHT11

DHT dht(DHT_PIN, DHT_TYPE);

// ==============================
// FSR Area
// FSR403 diameter = 12.7 mm
// ==============================

const float DIAMETER_M = 0.0127;
const float RADIUS_M = DIAMETER_M / 2.0;

const float FSR_AREA_M2 =
    3.14159265 * RADIUS_M * RADIUS_M;

const float PA_PER_MMHG = 133.322;

// ==============================
// FSR Calibration
// ==============================
//
// TEMPORARY calibration value.
// Replace this with your experimentally
// calibrated ADC -> Force relationship.

const float FORCE_PER_ADC = 0.001;

// ADC samples averaged per reading, to smooth out noise.
const int FSR_SAMPLES = 20;

// ==============================
// State
// ==============================

unsigned long lastSendMs = 0;

// The DHT11 sometimes fails a read; the last good values are sent instead.
float lastTemperature = NAN;
float lastHumidity = NAN;


// ==============================
// Wi-Fi
// ==============================

void connectWiFi() {

    if (WiFi.status() == WL_CONNECTED) return;

    Serial.print("Connecting to Wi-Fi ");
    Serial.print(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long started = millis();

    while (WiFi.status() != WL_CONNECTED && millis() - started < 20000) {
        delay(500);
        Serial.print(".");
    }

    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.print("Wi-Fi connected, IP: ");
        Serial.println(WiFi.localIP());
    }
    else {
        Serial.println("Wi-Fi connection failed, retrying next reading.");
    }
}


// ==============================
// Upload
// ==============================

// Sends one reading and prints the status the backend replies with.
void sendReading(float pressureMmHg, float temperature, float humidity) {

    String url = String(SERVER_URL) + "/api/devices/" + DEVICE_ID + "/readings";

    String body = String("{\"pressure\":") + String(pressureMmHg, 1) +
                  ",\"temperature\":" + String(temperature, 1) +
                  ",\"humidity\":" + String(humidity, 1) + "}";

    WiFiClient plainClient;
    WiFiClientSecure secureClient;
    // Skips certificate checks: fine for a prototype, not for real patient data.
    secureClient.setInsecure();

    HTTPClient http;
    bool https = url.startsWith("https://");

    if (!(https ? http.begin(secureClient, url) : http.begin(plainClient, url))) {
        Serial.println("Upload  : could not open the connection");
        return;
    }

    http.addHeader("Content-Type", "application/json");
    http.addHeader("X-Device-Key", DEVICE_API_KEY);
    // A sleeping free Render service can take ~50 s to wake up.
    http.setTimeout(20000);

    int status = http.POST(body);
    String reply = http.getString();
    http.end();

    if (status != 201) {
        Serial.print("Upload  : failed, HTTP ");
        Serial.println(status);
        Serial.println(reply);
        return;
    }

    // The reply is the scored reading. Check the status without a JSON library.
    String level = "CALIBRATING";
    if (reply.indexOf("\"riskLevel\":\"CRITICAL\"") >= 0) level = "CRITICAL";
    else if (reply.indexOf("\"riskLevel\":\"ATTENTION\"") >= 0) level = "ATTENTION";
    else if (reply.indexOf("\"riskLevel\":\"NORMAL\"") >= 0) level = "NORMAL";

    Serial.print("Status  : ");
    Serial.println(level);

    if (ALERT_PIN >= 0) {
        digitalWrite(ALERT_PIN, level == "CRITICAL" ? HIGH : LOW);
    }
}


// ==============================
// Setup
// ==============================

void setup() {

    Serial.begin(115200);

    delay(1000);

    // ESP32 ADC
    analogReadResolution(12);

    analogSetPinAttenuation(FSR_PIN, ADC_11db);

    // DHT11
    dht.begin();

    if (ALERT_PIN >= 0) {
        pinMode(ALERT_PIN, OUTPUT);
        digitalWrite(ALERT_PIN, LOW);
    }

    Serial.println();
    Serial.println("======================================");
    Serial.println("       MEDICAL PATCH SENSOR");
    Serial.println("======================================");
    Serial.println("FSR403 -> GPIO34");
    Serial.println("DHT11  -> GPIO4");
    Serial.print("Device -> ");
    Serial.println(DEVICE_ID);
    Serial.println("======================================");
    Serial.println();

    connectWiFi();
}


// ==============================
// Main Loop
// ==============================

void loop() {

    if (millis() - lastSendMs < SEND_INTERVAL_MS) return;
    lastSendMs = millis();

    // ==================================
    // READ FSR (averaged)
    // ==================================

    long adcTotal = 0;

    for (int i = 0; i < FSR_SAMPLES; i++) {
        adcTotal += analogRead(FSR_PIN);
        delay(2);
    }

    int fsrADC = adcTotal / FSR_SAMPLES;

    int fsrVoltage = analogReadMilliVolts(FSR_PIN);


    // ==================================
    // CALCULATE FORCE AND PRESSURE
    // ==================================

    float forceN = fsrADC * FORCE_PER_ADC;

    float pressurePa =
        forceN / FSR_AREA_M2;

    // The backend and app work in mmHg.
    float pressureMmHg = pressurePa / PA_PER_MMHG;


    // ==================================
    // READ DHT11
    // ==================================

    float temperature = dht.readTemperature();

    float humidity = dht.readHumidity();

    bool dhtOk = !isnan(temperature) && !isnan(humidity);

    if (dhtOk) {
        lastTemperature = temperature;
        lastHumidity = humidity;
    }


    // ==================================
    // DISPLAY
    // ==================================

    Serial.println("--------------------------------------");

    Serial.print("FSR ADC     : ");
    Serial.print(fsrADC);
    Serial.print(" / 4095  (");
    Serial.print(fsrVoltage);
    Serial.println(" mV)");

    Serial.print("Force       : ");
    Serial.print(forceN, 3);
    Serial.println(" N");

    Serial.print("Pressure    : ");
    Serial.print(pressurePa, 0);
    Serial.print(" Pa = ");
    Serial.print(pressureMmHg, 1);
    Serial.println(" mmHg");

    if (dhtOk) {
        Serial.print("Temperature : ");
        Serial.print(temperature, 1);
        Serial.println(" °C");

        Serial.print("Humidity    : ");
        Serial.print(humidity, 1);
        Serial.println(" %");
    }
    else {
        Serial.println("DHT11       : read failed");
    }


    // ==================================
    // SEND TO BACKEND
    // ==================================

    if (isnan(lastTemperature) || isnan(lastHumidity)) {
        Serial.println("Upload  : skipped, no DHT11 reading yet");
        return;
    }

    connectWiFi();

    if (WiFi.status() == WL_CONNECTED) {
        sendReading(pressureMmHg, lastTemperature, lastHumidity);
    }
}
