import { randomUUID } from 'node:crypto';
import { closeDatabase, getDatabase } from '../src/mongodb.ts';
import { ConfigurationError } from '../src/config.ts';

const probe = randomUUID();
let collection: ReturnType<Awaited<ReturnType<typeof getDatabase>>['collection']> | undefined;
try {
  const database = await getDatabase();
  await database.command({ ping: 1 }, { timeoutMS: 5_000 });
  collection = database.collection('__diagnostics');
  await collection.insertOne({ probe, createdAt: new Date() });
  const document = await collection.findOne({ probe });
  if (!document) throw new Error('Probe não encontrado.');
  console.info('MongoDB: conexão, escrita e leitura concluídas.');
} catch (error) {
  const details = error as {
    name?: string;
    code?: number | string;
    syscall?: string;
    hostname?: string;
    address?: string;
    port?: number;
  };

  console.error('Diagnóstico MongoDB:', {
    node: process.version,
    tipo: details?.name,
    codigo: details?.code,
    operacao: details?.syscall,
    destino: details?.hostname ?? details?.address,
    porta: details?.port,
  });
  console.error(
    error instanceof ConfigurationError
      ? 'Configure MONGODB_URI e MONGODB_DATABASE em apps/api/.env.'
      : 'MongoDB indisponível. Verifique o serviço, as credenciais e a liberação de rede.',
  );
  process.exitCode = 1;
} finally {
  try {
    await collection?.deleteOne({ probe });
  } catch {
    console.error('Não foi possível remover o probe de diagnóstico.');
    process.exitCode = 1;
  }
  await closeDatabase();
}
