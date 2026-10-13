import { config } from 'dotenv';

// En local se leen las claves de .env.local; en CI vienen como variables de entorno
config({ path: '.env.local', quiet: true });
