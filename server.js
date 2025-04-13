import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

class CustomAuthProvider {
  async authenticate(req) {
    // Implement your custom authentication logic
    return true;
  }

  getAuthError() {
    return {
      status: 401,
      message: "Authentication failed"
    };
  }
}

console.log("Starting server...");
const server = new Server(
  {
    name: "Time MCP Server",
    version: "1.0.0",
    transport: {
      options: {
        auth: {
          provider: CustomAuthProvider
        }
      }
    }
  },
  {
    capabilities: {
      tools: {},
    },
  }
);
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_current_time",
        description: "Get the current time in Japan",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  }
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  console.log(request, 3423)
  switch (request.params.name) {
    case "get_current_time":
      return {
        content: [
          {
            type: "text",
            text: new Date().toLocaleString("ja-JP", {
              timeZone: "Asia/Tokyo",
            }),
          },
        ],
      }
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});
const transport = new StdioServerTransport();
await server.connect(transport);
console.log("Server connected and ready!");