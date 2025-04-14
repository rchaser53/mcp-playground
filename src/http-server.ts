import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import http from "http";

class SSEServer {
  private server: Server;
  private activeTransport: SSEServerTransport | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "sse-server",
        version: "1.0.0",
      },
      {
        capabilities: {}
      }
    );
  }

  async start(port: number = 3000) {
    const httpServer = http.createServer(async (req, res) => {
      if (req.method === "GET" && req.url === "/events") {
        console.log("New SSE connection");
        
        // 新しい接続用のトランスポートを作成
        const transport = new SSEServerTransport("/messages", res);
        this.activeTransport = transport; 
        await this.server.connect(transport);

        res.on("close", () => {
          console.log("SSE connection closed");
          if (this.activeTransport === transport) {
            this.activeTransport = null;
          }
        });

        this.startSending(transport);
        return;
      }

      if (req.method === "POST" && req.url?.startsWith("/messages")) {
        if (!this.activeTransport) {
          res.writeHead(400).end("No active transport");
          return;
        }
        //POSTリクエストを処理
        await this.activeTransport.handlePostMessage(req, res);
        return;
      }

      res.writeHead(404).end();
    });

    httpServer.listen(port, () => {
      console.log(`SSE Server running at http://localhost:${port}`);
      console.log(`SSE endpoint: http://localhost:${port}/events`);
    });
  }

  private async startSending(transport: SSEServerTransport) {
    try {
      await transport.send({
        jsonrpc: "2.0",
        method: "sse/connection",
        params: { message: "SSE Connection established" }
      });

      let messageCount = 0;
      const interval = setInterval(async () => {
        messageCount++;
        const message = `Message ${messageCount} at ${new Date().toISOString()}`;

        try {
          await transport.send({
            jsonrpc: "2.0",
            method: "sse/message",
            params: { data: message }
          });

          console.log(`Sent: ${message}`);

          if (messageCount === 10) {
            clearInterval(interval);
            await transport.send({
              jsonrpc: "2.0",
              method: "sse/complete",
              params: { message: "Stream completed" }
            });
            console.log("Stream completed");
          }
        } catch (error) {
          console.error("Error sending message:", error);
          clearInterval(interval);
        }
      }, 1000);

    } catch (error) {
      console.error("Error in startSending:", error);
    }
  }
}

new SSEServer().start().catch(console.error);
