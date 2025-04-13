import Anthropic from "@anthropic-ai/sdk";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  CallToolResultSchema,
  ListToolsResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createInterface } from "node:readline/promises";

const client = new Client(
  {
    name: "test-client",
    version: "1.0.0",
  },
  {
    capabilities: {},
  }
);

const transport = new StdioClientTransport({
  command: "node",
  args: ["server.js"],
  stderr: "pipe",
});

const llmClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

await client.connect(transport);

transport.stderr.on("data", (chunk) => {
    const message = chunk.toString();
    // write to file, etc.
  });

const response = await client.request(
  {
    method: "tools/list",
  },
  ListToolsResultSchema
);

const tools = response.tools.map((tool) => ({
  name: tool.name,
  description: tool.description,
  input_schema: tool.inputSchema,
}));

let messages = [];
const ask = async (input) => {
  const output = [];
  messages.push({
    role: "user",
    content: input,
  });

  while (true) {
    let message = await llmClient.messages.create({
      model: "claude-3-5-sonnet-latest",
      max_tokens: 1000,
      messages,
      tools,
    });
    messages.push({
      role: "assistant",
      content: message.content,
    });
    for (const content of message.content) {
      switch (content.type) {
        case "text":
          output.push(`AI: ${content.text}`);
          continue;
        case "tool_use":
          output.push(
            `Tool use: ${content.name} ${JSON.stringify(content.input)}`
          );
          const toolResult = await client.request(
            {
              method: "tools/call",
              params: {
                name: content.name,
                arguments: content.input,
              },
            },
            CallToolResultSchema
          );
          output.push(`Tool result: ${JSON.stringify(toolResult.content)}`);
          messages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: content.id,
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(toolResult.content),
                  },
                ],
              },
            ],
          });

          continue;
      }
    }
    if (message.stop_reason === "end_turn") {
      break;
    }
  }

  return output.join("\n");
};

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = async () => {
  const input = await rl.question("\nYou: ");
  if (input === "quit") {
    rl.close();
    process.exit(0);
  }

  const output = await ask(input);
  console.log(`\n${output}`);
  askQuestion();
};

await askQuestion();