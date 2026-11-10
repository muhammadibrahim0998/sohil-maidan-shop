import pool, { testMySQLConnection } from './mysql.js';

export const connectDB = testMySQLConnection;
export default pool;
