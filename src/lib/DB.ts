import { Config } from "./Config";
import sqlite3 from "sqlite3";

const db = new sqlite3.Database(Config.db);

export function query(sql, params): Object {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      resolve(row);
    });
  });
}

export function exec(sql, params) {
  return new Promise<void>((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) reject(err);
      resolve();
    });
  });
}
