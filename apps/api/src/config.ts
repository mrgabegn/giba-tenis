export class ConfigurationError extends Error {
  constructor() {
    super('Configuração do servidor indisponível.');
    this.name = 'ConfigurationError';
  }
}

export function getDatabaseConfig(env: NodeJS.ProcessEnv = process.env) {
  const uri = env.MONGODB_URI?.trim();
  const database = env.MONGODB_DATABASE?.trim();
  if (
    !uri ||
    !/^mongodb(?:\+srv)?:\/\//.test(uri) ||
    !database ||
    /[\s\/\\."$*<>:|?\0]/.test(database)
  ) {
    throw new ConfigurationError();
  }
  return { uri, database };
}
