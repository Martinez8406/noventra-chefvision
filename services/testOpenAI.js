import OpenAI from "openai";

async function main() {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Missing OPENAI_API_KEY in environment.");

    const client = new OpenAI({ apiKey });

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: "Powiedz tylko: działa",
    });

    console.log((response.output_text ?? "").trim());
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
  }
}

main();
