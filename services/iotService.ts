
import { IotConfig, SensorData } from "../types";
import mqtt from 'mqtt';

// Public HiveMQ Broker for demo purposes (using WebSockets)
const BROKER_URL = "wss://broker.hivemq.com:8000/mqtt";

export const generateApiKey = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'FARM-';
    for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

export const generateIotConfig = (userId: string): IotConfig => {
    const key = generateApiKey();
    return {
        api_key: key,
        topic: `cropsafe/${key}/data`,
        broker_url: BROKER_URL,
        last_connected: undefined
    };
};

const escapeCppString = (str: string): string => str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export const generateEsp32Code = (config: IotConfig, ssid: string = "YourWiFi", password: string = "YourPassword"): string => {
    const safeSsid = escapeCppString(ssid);
    const safePass = escapeCppString(password);

    return `
/**
 * FASAL RAKSHAK - ESP32 SENSOR NODE
 */
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "${safeSsid}";
const char* password = "${safePass}";
// Use standard TCP port for ESP32
const char* mqtt_server = "broker.hivemq.com"; 
const int mqtt_port = 1883;
const char* topic = "${config.topic}";

WiFiClient espClient;
PubSubClient client(espClient);
const int SOIL_PIN = 34;

void setup() {
  Serial.begin(115200);
  delay(1000);
  setup_wifi();
  client.setServer(mqtt_server, mqtt_port);
}

void setup_wifi() {
  delay(10);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    if (client.connect(clientId.c_str())) {
      // Connected
    } else {
      delay(5000);
    }
  }
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  int rawSoil = analogRead(SOIL_PIN);
  float soil_moisture = map(rawSoil, 4095, 1500, 0, 100); 
  
  StaticJsonDocument<256> doc;
  doc["soil_moisture"] = soil_moisture;
  doc["temperature"] = 28.0; // Replace with DHT read
  doc["humidity"] = 60.0;
  
  char buffer[512];
  serializeJson(doc, buffer);
  client.publish(topic, buffer);
  
  delay(5000); // 5 seconds for demo responsiveness
}
    `;
};

// --- REAL MQTT CONNECTION ---
const activeClients = new Map<string, mqtt.MqttClient>();
const sensorDataCache = new Map<string, SensorData>();

export const simulateIncomingSensorData = (apiKey: string) => {
    // This function acts as the "Connector"
    // Named simulate to keep compatibility with existing calls, but implementation is real
    if (!activeClients.has(apiKey)) {
        connectToBroker(apiKey);
    }
};

const connectToBroker = (apiKey: string) => {
    const topic = `cropsafe/${apiKey}/data`;
    console.log(`[IoT] Connecting to ${BROKER_URL} for ${topic}`);
    
    try {
        const client = mqtt.connect(BROKER_URL);

        client.on('connect', () => {
            console.log(`[IoT] Connected to broker for ${apiKey}`);
            client.subscribe(topic, (err) => {
                if (!err) console.log(`[IoT] Subscribed to ${topic}`);
            });
        });

        client.on('message', (topic, message) => {
            try {
                const payload = JSON.parse(message.toString());
                const data: SensorData = {
                    soil_moisture: payload.soil_moisture || 0,
                    temperature: payload.temperature || 0,
                    humidity: payload.humidity || 0,
                    ph: payload.ph || 7.0,
                    leaf_wetness: payload.leaf_wetness || 0,
                    timestamp: Date.now()
                };
                sensorDataCache.set(apiKey, data);
            } catch (e) {
                console.warn("[IoT] Malformed packet", message.toString());
            }
        });

        activeClients.set(apiKey, client);
    } catch (e) {
        console.error("[IoT] Connection failed", e);
    }
};

export const getLatestSensorData = (apiKey: string): SensorData | null => {
    // Return real data if available
    if (sensorDataCache.has(apiKey)) {
        const data = sensorDataCache.get(apiKey)!;
        // If data is stale (> 60s), return null to indicate offline
        if (Date.now() - data.timestamp < 60000) {
            return data;
        }
    }
    
    // FIX: Do NOT return mock data here. If no real data, return null.
    // This ensures the UI accurately reflects "Offline" status rather than confusing the user.
    return null;
};
