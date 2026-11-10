import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

// High Performance MySQL Connection Pool for `online_pos_software`
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'online_pos_software',
  waitForConnections: true,
  connectionLimit: 20,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export const testMySQLConnection = async () => {
  try {
    const connection = await pool.getConnection();
    const dbName = process.env.MYSQL_DATABASE || 'online_pos_software';
    console.log(`✅ MySQL Database Connected Successfully: \`${dbName}\``);
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ MySQL Connection Error:', error.message);
    return false;
  }
};

export default pool;
