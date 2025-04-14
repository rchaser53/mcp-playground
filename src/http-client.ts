import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { URL } from 'url';
import { EventSource } from 'eventsource';

(global as any).EventSource = EventSource;

class SSEClient {
  private client: Client;
  private transport: SSEClientTransport;
  private isCompleted: boolean = false;

  constructor(serverUrl: string = "http://localhost:3000") {
    const url = new URL("/events", serverUrl);
    this.transport = new SSEClientTransport(url);
    
    this.client = new Client(
      {
        name: "sse-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  async connect() {
    try {
      await this.client.connect(this.transport);
      console.log("Connected to server");

      // メッセージハンドラーを設定
      this.transport.onmessage = (message: any) => {
        if (!message || typeof message.method !== 'string') {
          return;
        }

        switch (message.method) {
          case "sse/connection":
            console.log("Connection established:", message.params.message);
            break;
          
          case "sse/message":
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] Received:`, message.params.data);
            break;
          
          case "sse/complete":
            console.log("\nStream completed:", message.params.message);
            this.isCompleted = true;
            break;
        }
      };

    } catch (error) {
      console.error("Connection error:", error);
      throw error;
    }
  }

  async waitForCompletion() {
    while (!this.isCompleted) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  async disconnect() {
    await this.client.close();
    console.log("Disconnected from server");
  }
}

async function main() {
  const serverUrl = process.env.SERVER_URL || "http://localhost:3000";
  console.log("Connecting to SSE server at:", serverUrl);
  
  const client = new SSEClient(serverUrl);
  try {
    await client.connect();
    await client.waitForCompletion();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.disconnect();
  }
}

if (import.meta.url.endsWith("http-client.ts")) {
  main().catch(console.error);
}