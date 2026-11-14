import fs from "node:fs/promises";
import path from "node:path";

async function resolveApiKey() {
  const fromEnv = process.env.N8N_API_KEY?.trim();
  if (fromEnv) return fromEnv;

  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const raw = await fs.readFile(envPath, "utf8");
    const match = raw.match(/^N8N_API_KEY=(.+)$/m);
    if (match?.[1]) {
      return match[1].trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // Ignore missing .env.local
  }
  return "";
}

async function main() {
  const apiKey = await resolveApiKey();
  if (!apiKey) {
    console.error("Uso: N8N_API_KEY=<sua-chave> npm run n8n:deploy-cloud");
    process.exit(1);
  }

  const baseUrl = (
    process.env.N8N_CLOUD_BASE_URL || "https://viniciusouza.app.n8n.cloud"
  ).replace(/\/+$/, "");
  const workflowId = (process.env.N8N_WORKFLOW_ID || "g0pWpUc5qLrx0wdw").trim();
  const wfPath = path.resolve(
    process.cwd(),
    "n8n",
    "workflow-arquibancada-ucl2027-cloud.json"
  );

  const rawWf = await fs.readFile(wfPath, "utf8");
  const wf = JSON.parse(rawWf);

  const putPayload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings: { executionOrder: "v1" },
  };

  console.log(`Atualizando workflow ${workflowId} em ${baseUrl}...`);
  const putRes = await fetch(`${baseUrl}/api/v1/workflows/${workflowId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-N8N-API-KEY": apiKey,
    },
    body: JSON.stringify(putPayload),
  });

  if (!putRes.ok) {
    const errText = await putRes.text().catch(() => "");
    console.error(`Falha no PUT (${putRes.status}): ${errText}`);
    process.exit(1);
  }
  console.log(`Workflow ${workflowId} atualizado com sucesso.`);

  console.log(`Ativando workflow ${workflowId}...`);
  const actRes = await fetch(
    `${baseUrl}/api/v1/workflows/${workflowId}/activate`,
    {
      method: "POST",
      headers: {
        "X-N8N-API-KEY": apiKey,
      },
    }
  );

  if (!actRes.ok) {
    const errText = await actRes.text().catch(() => "");
    console.error(`Falha ao ativar (${actRes.status}): ${errText}`);
    process.exit(1);
  }
  console.log("Workflow ativado em producao.");

  const webhookUrl = `${baseUrl}/webhook/arquibancada-ucl2027`;
  console.log(`Testando webhook de producao: ${webhookUrl}`);
  const probeRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (probeRes.status !== 401) {
    const probeText = await probeRes.text().catch(() => "");
    console.error(
      `Probe retornou HTTP ${probeRes.status} (esperado 401): ${probeText}`
    );
    process.exit(1);
  }

  console.log(`Webhook validado em producao (HTTP 401 esperado): ${webhookUrl}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
