import { Level } from "level";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "data_indexer");

async function diagnose() {
  console.log(`🔍 Inspecting LevelDB at: ${dbPath}`);
  const db = new Level(dbPath, { valueEncoding: "json" });
  await db.open();

  let tokenCount = 0;
  let txCount = 0;
  let lastBlock = -1;

  try {
    lastBlock = await db.get("meta:lastBlock");
  } catch (e) {}

  console.log(`📊 Last Indexed Block: ${lastBlock}`);

  console.log("\n--- Tokens Found ---");
  for await (const [key, value] of db.iterator({
    gte: "token:",
    lte: "token:\xFF",
  })) {
    tokenCount++;
    console.log(`Entry: ${key} -> ${JSON.stringify(value)}`);
  }

  console.log(`\n--- Transaction Sample (First 5) ---`);
  let i = 0;
  for await (const [key, value] of db.iterator({
    gte: "tx:hash:",
    lte: "tx:hash:\xFF",
  })) {
    if (i++ < 5) console.log(`Tx: ${key}`);
    txCount++;
  }

  console.log(`\n✅ Summary:`);
  console.log(`- Total Tokens: ${tokenCount}`);
  console.log(`- Total Transactions: ${txCount}`);

  await db.close();
}

diagnose().catch(console.error);
