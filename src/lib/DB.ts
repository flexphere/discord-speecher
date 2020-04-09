import * as mysql from 'promise-mysql';
import { Config } from './Config'

let connection: mysql.Connection;

export async function Connection() {
    if (connection) {
        return connection;
    }

    connection = await mysql.createConnection({
        host: Config.db.host,
        user: Config.db.user,
        password: Config.db.password,
        database: Config.db.database,
        multipleStatements: true
    });
    return connection;
}