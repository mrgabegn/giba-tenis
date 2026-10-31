import { MongoClient, type Db } from 'mongodb';
import { getDatabaseConfig } from './config.ts';

// Uma conexão/pool por instância aquecida da função, compartilhada entre requisições.
let connectedClient: MongoClient | undefined;
let connection: Promise<MongoClient> | undefined;

export async function getDatabase(): Promise<Db> {
  const { uri, database } = getDatabaseConfig();
  if (!connection) {
    const candidate = new MongoClient(uri, {
      appName: 'giba-tenis-api',
      maxPoolSize: 5,
      minPoolSize: 0,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 3_000,
      connectTimeoutMS: 3_000,
      socketTimeoutMS: 5_000,
      waitQueueTimeoutMS: 3_000,
    });
    connection = candidate.connect().then(
      (client) => {
        connectedClient = client;
        return client;
      },
      async (error: unknown) => {
        connection = undefined;
        await candidate.close().catch(() => undefined);
        throw error;
      },
    );
  }
  return (await connection).db(database);
}

export async function pingDatabase(): Promise<void> {
  const database = await getDatabase();
  await database.command({ ping: 1 }, { timeoutMS: 5_000 });
}

// Usado por scripts e pelo encerramento do servidor local, não a cada requisição.
export async function closeDatabase(): Promise<void> {
  const client = connectedClient ?? (await connection?.catch(() => undefined));
  connection = undefined;
  connectedClient = undefined;
  await client?.close();
}
