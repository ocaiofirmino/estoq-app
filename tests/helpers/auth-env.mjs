import {hashPassword} from '../../lib/auth.mjs';

// Dados exclusivos da suíte: não são credenciais da aplicação publicada.
export const testPassword='estoq-fixture-only-password';
const testHash=await hashPassword(testPassword);
process.env.CAIO_PASSWORD_HASH=testHash;
process.env.LAYLAH_PASSWORD_HASH=testHash;
